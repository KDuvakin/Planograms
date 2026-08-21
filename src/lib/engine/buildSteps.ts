import { EPS, FIT_SLACK, type EngineState, type Product, type Step } from "./types";
import { isAnchor, neededWidthOf, widthOf } from "./helpers";

type Location =
  | { type: "shelf"; rack: string; shelf: string }
  | { type: "tempBasket" }
  | { type: "newBasket" }
  | { type: "deletedBasket" };

/**
 * Computes the full ordered action plan (steps) to go from the OLD layout to
 * the NEW layout: walks the NEW layout rack by rack, shelf by shelf, left to
 * right, greedily freeing space by evicting neighbours and placing/moving/
 * resizing items into position. Computed once, only ever replayed afterwards
 * — so the plan and its playback can never diverge.
 */
export function buildSteps(state: EngineState): void {
  const steps: Step[] = [];
  const remainingByShelf: Record<string, Record<string, Product[]>> = {};
  const location: Record<number, Location> = {};

  state.products.forEach((p) => {
    if (p.isNew) {
      location[p.index] = { type: "newBasket" };
      return;
    }
    const r = p.rackOld;
    const s = p.shelfOld;
    if (!remainingByShelf[r]) remainingByShelf[r] = {};
    if (!remainingByShelf[r][s]) remainingByShelf[r][s] = [];
    remainingByShelf[r][s].push(p);
    location[p.index] = { type: "shelf", rack: r, shelf: s };
  });

  // Old-physical queue, consumed front-first — sorted so the front is always
  // "the next old item in the direction we're sweeping": left-to-right normally,
  // right-to-left when mirrored (kept in lockstep with the target-visit order below).
  Object.keys(remainingByShelf).forEach((r) => {
    Object.keys(remainingByShelf[r]).forEach((s) => {
      remainingByShelf[r][s].sort((a, b) => {
        const diff = (parseInt(a.positionNumberOld, 10) || 0) - (parseInt(b.positionNumberOld, 10) || 0);
        return state.mirrored ? -diff : diff;
      });
    });
  });

  // target layout: only products that have a new place
  const targetByShelf: Record<string, Record<string, Product[]>> = {};
  state.products
    .filter((p) => !p.isDeleted)
    .forEach((p) => {
      const r = p.rackNew;
      const s = p.shelfNew;
      if (!targetByShelf[r]) targetByShelf[r] = {};
      if (!targetByShelf[r][s]) targetByShelf[r][s] = [];
      targetByShelf[r][s].push(p);
    });
  // Always sorted ascending regardless of mirroring — `ti` (this array's index) doubles as
  // each item's render rank via insertByTi(), so the rendered shelf always ends up in true
  // left-to-right position order; the mirrored-visit-order loop below reads this same
  // ascending array back-to-front instead of re-sorting it, keeping that render rank intact.
  Object.keys(targetByShelf).forEach((r) => {
    Object.keys(targetByShelf[r]).forEach((s) => {
      targetByShelf[r][s].sort(
        (a, b) => (parseInt(a.positionNumberNew, 10) || 0) - (parseInt(b.positionNumberNew, 10) || 0)
      );
    });
  });

  function removeFromWhereverItIs(p: Product) {
    const loc = location[p.index];
    if (loc && loc.type === "shelf") {
      const arr = remainingByShelf[loc.rack]?.[loc.shelf];
      if (arr) {
        const idx = arr.findIndex((x) => x.index === p.index);
        if (idx !== -1) arr.splice(idx, 1);
      }
    }
  }

  const rackKeys = Object.keys(targetByShelf).sort((a, b) =>
    state.mirrored ? parseInt(b, 10) - parseInt(a, 10) : parseInt(a, 10) - parseInt(b, 10)
  );

  rackKeys.forEach((r) => {
    const shelfKeys = Object.keys(targetByShelf[r]).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

    shelfKeys.forEach((s) => {
      const target = targetByShelf[r][s];
      if (!remainingByShelf[r]) remainingByShelf[r] = {};
      if (!remainingByShelf[r][s]) remainingByShelf[r][s] = [];
      const remaining = remainingByShelf[r][s]; // queue of physically-present items, eaten from the front

      // accumulated free width (cm) on THIS shelf — always starts at zero: even if
      // something left from here earlier for another shelf, the physical space ahead
      // may be occupied by a completely different, still-untouched item — it must
      // actually be evicted first, not "virtually" borrow someone else's freed space
      let freeWidth = 0;

      function evictNow(item: Product) {
        if (item.isDeleted) {
          steps.push({ type: "evict", product: item, to: "deleted", rack: r, shelf: s });
          location[item.index] = { type: "deletedBasket" };
        } else {
          steps.push({ type: "evict", product: item, to: "temp", rack: r, shelf: s });
          location[item.index] = { type: "tempBasket" };
        }
      }

      // if placing an item leaves us short (it needed MORE width than got freed),
      // free up more from its right-hand neighbours
      function topUpIfNegative() {
        while (freeWidth < -FIT_SLACK && remaining[0] && !isAnchor(remaining[0])) {
          const ev = remaining.shift()!;
          freeWidth += widthOf(ev);
          evictNow(ev);
        }
      }

      // strictly left to right, without jumping ahead: the next target position is
      // only handled once the previous one is fully resolved — this guarantees
      // already-placed items never shift on screen when the next one is inserted.
      // finds missing centimetres for a growing item STRICTLY from its RIGHT
      // neighbours, in order, without skipping past them: growth happens in place,
      // so it can only really displace its immediate neighbour — not some other
      // evicted item further down the shelf
      function fillDeficit(deficitIn: number) {
        let deficit = deficitIn;
        while (deficit > FIT_SLACK && remaining.length > 1) {
          const blocker = remaining.splice(1, 1)[0];
          const w = widthOf(blocker);
          freeWidth += w;
          deficit -= w;
          evictNow(blocker);
        }
      }

      // Visits `target` back-to-front when mirrored (right-to-left), in lockstep with the
      // reversed `remaining` queue above — `ti` itself still means "true ascending render
      // rank", only the VISIT sequence (which position gets worked on 1st/2nd/...) flips.
      for (let step = 0; step < target.length; step++) {
        const ti = state.mirrored ? target.length - 1 - step : step;
        const want = target[ti];
        const neededWidth = neededWidthOf(want);
        const wantIsAnchor = isAnchor(want);

        if (wantIsAnchor && remaining[0] && remaining[0].index === want.index) {
          // product never changed rack, shelf, or position number — don't touch it.
          // if only the face count changed, adjust width/pool in place
          const oldWidth = widthOf(remaining[0]);
          const growthDeficit = neededWidth - oldWidth - freeWidth;

          if (growthDeficit > FIT_SLACK) {
            // item is GROWING and already-free space isn't enough — find the missing
            // centimetres FURTHER down the shelf first, and only then grow it. Otherwise
            // a "debt" would briefly appear on screen, and paying it off later would look
            // like a shift of still-untouched items.
            fillDeficit(growthDeficit);
          }

          const item = remaining.shift()!;
          const delta = widthOf(item) - neededWidth;
          freeWidth += delta;

          if (Math.abs(delta) > EPS) {
            steps.push({ type: "resize", product: item, faces: want.facesNew, rack: r, shelf: s, ti });
          } else {
            steps.push({ type: "confirm", product: item, rack: r, shelf: s, ti });
          }

          location[item.index] = { type: "shelf", rack: r, shelf: s };
          topUpIfNegative();
          continue;
        }

        // free up space by evicting blockers ONE AT A TIME (never touching anchors),
        // until enough width is gathered or we reach `want` itself
        while (
          freeWidth + FIT_SLACK < neededWidth &&
          remaining[0] &&
          remaining[0].index !== want.index &&
          !isAnchor(remaining[0])
        ) {
          const blocker = remaining.shift()!;
          freeWidth += widthOf(blocker);
          evictNow(blocker);
        }

        // still short and only an anchor stands in the way — as a last resort evict it
        // too (it'll come back to its own spot in a separate step once there's room)
        while (freeWidth + FIT_SLACK < neededWidth && remaining[0] && remaining[0].index !== want.index) {
          const blocker = remaining.shift()!;
          freeWidth += widthOf(blocker);
          evictNow(blocker);
        }

        // place `want` — if it's physically right here (but not an anchor) or coming from elsewhere
        if (remaining[0] && remaining[0].index === want.index) {
          const oldWidth = widthOf(remaining[0]);
          const growthDeficit = neededWidth - oldWidth - freeWidth;

          if (growthDeficit > FIT_SLACK) {
            // grows more than what's already freed — free up more FURTHER down the shelf
            // BEFORE moving it, otherwise a "debt" would briefly appear on screen
            fillDeficit(growthDeficit);
          }

          // it was already standing here (just at a different position/face count) — its
          // old width never went to the basket, so credit it before charging the new needed width
          freeWidth += oldWidth;
          remaining.shift();
          steps.push({
            type: "move",
            product: want,
            fromRack: want.rackOld,
            fromShelf: want.shelfOld,
            rack: r,
            shelf: s,
            ti,
          });
        } else {
          removeFromWhereverItIs(want);
          const source = location[want.index] ? location[want.index].type : "newBasket";
          if (source === "shelf") {
            steps.push({
              type: "move",
              product: want,
              fromRack: want.rackOld,
              fromShelf: want.shelfOld,
              rack: r,
              shelf: s,
              ti,
            });
          } else {
            steps.push({
              type: "place",
              product: want,
              rack: r,
              shelf: s,
              source: source as "tempBasket" | "newBasket",
              ti,
            });
          }
        }

        location[want.index] = { type: "shelf", rack: r, shelf: s };
        freeWidth -= neededWidth;
        topUpIfNegative();
      }

      // tail — items left physically on the shelf but not wanted here by anyone
      while (remaining.length) {
        evictNow(remaining.shift()!);
      }
    });
  });

  // safety net: shelves that don't appear in the new layout at all
  Object.keys(remainingByShelf).forEach((r) => {
    Object.keys(remainingByShelf[r]).forEach((s) => {
      if (targetByShelf[r]?.[s]) return; // already handled above
      while (remainingByShelf[r][s].length) {
        const occupant = remainingByShelf[r][s].shift()!;
        if (occupant.isDeleted) {
          steps.push({ type: "evict", product: occupant, to: "deleted", rack: r, shelf: s });
          location[occupant.index] = { type: "deletedBasket" };
        } else {
          steps.push({ type: "evict", product: occupant, to: "temp", rack: r, shelf: s });
          location[occupant.index] = { type: "tempBasket" };
        }
      }
    });
  });

  state.steps = mergeAdjacentMoves(steps);
  computeClickBoundaries(state);
}

/**
 * If an item is evicted and IMMEDIATELY (next step, nothing in between) placed
 * back — that's really one action ("move it"), not "evict to basket" + "take
 * from basket". The space is already free, so there's no need to visit the basket.
 */
function mergeAdjacentMoves(steps: Step[]): Step[] {
  const merged: Step[] = [];
  for (let i = 0; i < steps.length; i++) {
    const cur = steps[i];
    const next = steps[i + 1];

    if (
      cur.type === "evict" &&
      cur.to === "temp" &&
      next?.type === "place" &&
      next.source === "tempBasket" &&
      cur.product.index === next.product.index
    ) {
      merged.push({
        type: "move",
        product: cur.product,
        fromRack: cur.rack,
        fromShelf: cur.shelf,
        rack: next.rack,
        shelf: next.shelf,
        ti: next.ti,
      });
      i++; // `next` is already accounted for in this merged step
    } else {
      merged.push(cur);
    }
  }
  return merged;
}

/**
 * "confirm" (item was already in place, no action needed) doesn't count as its
 * own click — it's silently folded into the next real action.
 * clickBoundaries[k] = raw index in `steps` right after the k-th real step.
 */
function computeClickBoundaries(state: EngineState): void {
  const clickBoundaries = [0];
  state.steps.forEach((step, i) => {
    if (step.type !== "confirm") clickBoundaries.push(i + 1);
  });
  state.realStepsTotal = clickBoundaries.length - 1;

  // trailing "silent" confirm steps (a shelf that was correct from the start, processed
  // last) would otherwise have nothing to attach to — fold them into the last real click
  if (clickBoundaries[clickBoundaries.length - 1] < state.steps.length) {
    clickBoundaries[clickBoundaries.length - 1] = state.steps.length;
  }

  state.clickBoundaries = clickBoundaries;
}

import {
  EPS_GAP,
  RENDER_FIT_SLACK,
  isGap,
  type EngineState,
  type GapMarker,
  type Product,
  type ShelfSlot,
  type ShelfState,
  type Step,
} from "./types";
import { widthOf } from "./helpers";

function ensureShelf(state: EngineState, r: string, s: string): ShelfState {
  if (!state.racks[r]) state.racks[r] = {};
  if (!state.racks[r][s]) state.racks[r][s] = { items: [], cursor: 0 };
  return state.racks[r][s];
}

/** Merges adjacent gap markers into one — otherwise a "does it fit" check would only see the first small piece instead of the combined width. */
function coalesceGaps(rs: ShelfState): void {
  for (let i = rs.items.length - 2; i >= 0; i--) {
    const cur = rs.items[i];
    const next = rs.items[i + 1];
    if (isGap(cur) && isGap(next)) {
      cur.width += next.width;
      if (next.fromProductIndexes?.length) {
        cur.fromProductIndexes = [...(cur.fromProductIndexes ?? []), ...next.fromProductIndexes];
      }
      rs.items.splice(i + 1, 1);
    }
  }
}

/**
 * Inserts an item at its target index (ti) — not "at the end", since with
 * recursive rearrangement items may not resolve strictly left to right. All
 * already-settled items carry `_ti` and are sorted by it first.
 *
 * The untouched remainder of the old layout (no `_ti`) sits on whichever side
 * hasn't been visited yet: the tail when sweeping left-to-right (ascending ti,
 * the default), the head when sweeping right-to-left (mirrored — settled items
 * arrive in DESCENDING ti order, so every already-settled neighbour necessarily
 * has a larger ti and belongs after the new one; untouched items belong before
 * and must NOT stop the scan). Gaps are skipped while locating this boundary —
 * they're not "untouched old layout", just leftover free space — and handled
 * separately below.
 *
 * Freed width is a single shared pool per shelf (mirroring how buildSteps'
 * own `freeWidth` ledger treats it), not pinned to wherever it happened to
 * originate: whichever gap can cover this item, wherever it sits, is fair
 * game. Preferring one already sitting at the boundary (checked first) simply
 * avoids reshuffling the array when nothing needs to move.
 */
function insertByTi(rs: ShelfState, item: Product, ti: number, mirrored: boolean): void {
  const neededW = item.faceWidth * (item.facesNew || item.currentFaces || 0);

  let idx = rs.items.length;
  for (let i = 0; i < rs.items.length; i++) {
    const slot = rs.items[i];
    if (isGap(slot)) continue;
    const t = (slot as Product)._ti;
    const isBoundary = mirrored ? t !== undefined && t > ti : t === undefined || t > ti;
    if (isBoundary) {
      idx = i;
      break;
    }
  }

  const fitsHere = (g: ShelfSlot | undefined): g is GapMarker => !!g && isGap(g) && g.width >= neededW - RENDER_FIT_SLACK;

  let gapIdx = fitsHere(rs.items[idx]) ? idx : -1;
  if (gapIdx === -1) {
    gapIdx = rs.items.findIndex((slot) => fitsHere(slot));
  }

  if (gapIdx !== -1) {
    const gap = rs.items[gapIdx] as GapMarker;
    const leftover = gap.width - neededW;
    rs.items.splice(gapIdx, 1);
    if (gapIdx < idx) idx--; // the removal shifted everything after it left by one
    rs.items.splice(idx, 0, item);
    item._ti = ti;
    if (leftover > EPS_GAP) {
      rs.items.splice(idx + 1, 0, { __gap: true, width: leftover } satisfies GapMarker);
    }
    return;
  }

  // no gap anywhere on the shelf covers this — insert at the boundary anyway
  // (the shelf is over-budget; buildSteps' freeWidth ledger already accounted
  // for this, there's simply nothing left to reuse)
  rs.items.splice(idx, 0, item);
  item._ti = ti;
}

/** Removes a product from its OWN old shelf — used only when taking it "off the rack" onto another shelf, when it hasn't been touched yet. */
function removeFromOldShelf(state: EngineState, p: Product): void {
  const rs = state.racks[p.rackOld]?.[p.shelfOld];
  if (!rs) return;
  const idx = rs.items.findIndex((x) => (x as Product).index === p.index);
  if (idx !== -1) rs.items[idx] = { __gap: true, width: widthOf(p), fromProductIndexes: [p.index] } satisfies GapMarker;
  coalesceGaps(rs);
}

/** Applies one step to the live racks/basket state. `silent` steps skip generating navigator text (used when fast-forwarding through absorbed steps). */
export function execute(state: EngineState, step: Step, silent: boolean): void {
  const p = step.product;
  const rs = ensureShelf(state, step.rack, step.shelf);

  if (step.type === "evict") {
    const idx = rs.items.findIndex((x) => (x as Product).index === p.index);
    if (idx !== -1) rs.items[idx] = { __gap: true, width: widthOf(p), fromProductIndexes: [p.index] } satisfies GapMarker;
    coalesceGaps(rs);

    if (step.to === "deleted") {
      if (!state.basket.deleted.find((x) => x.index === p.index)) state.basket.deleted.push(p);
      p.state = "deleted";
      if (!silent) {
        state.navigator = {
          kind: "delete",
          key: "delete",
          params: { article: p.article, sap: p.sap, rack: step.rack, shelf: step.shelf, pos: p.positionNumberOld },
        };
      }
    } else {
      if (!state.basket.temp.find((x) => x.index === p.index)) state.basket.temp.push(p);
      p.state = "temp";
      if (!silent) {
        state.navigator = {
          kind: "pick",
          key: "pick",
          params: { article: p.article, sap: p.sap, rack: step.rack, shelf: step.shelf, pos: p.positionNumberOld },
        };
      }
    }
  } else if (step.type === "move") {
    const fromRs = ensureShelf(state, step.fromRack, step.fromShelf);
    const idx = fromRs.items.findIndex((x) => (x as Product).index === p.index);
    if (idx !== -1) fromRs.items[idx] = { __gap: true, width: widthOf(p), fromProductIndexes: [p.index] } satisfies GapMarker;
    coalesceGaps(fromRs);

    const sameShelf = step.fromRack === step.rack && step.fromShelf === step.shelf;
    const oldPos = p.positionNumberOld;

    p.currentFaces = p.facesNew;
    p.state = "correct";

    insertByTi(rs, p, step.ti!, state.mirrored);
    rs.cursor++;

    if (!silent) {
      state.navigator = sameShelf
        ? {
            kind: "move",
            key: "moveSame",
            params: { article: p.article, sap: p.sap, rack: step.rack, shelf: step.shelf, oldPos, newPos: p.positionNumberNew },
          }
        : {
            kind: "move",
            key: "moveDifferent",
            params: {
              article: p.article,
              sap: p.sap,
              fromRack: step.fromRack,
              fromShelf: step.fromShelf,
              rack: step.rack,
              shelf: step.shelf,
              newPos: p.positionNumberNew,
              faces: p.facesNew,
            },
          };
    }
  } else if (step.type === "confirm") {
    p._ti = step.ti;
    rs.cursor++;
    p.state = "correct";
    if (!silent) {
      state.navigator = { kind: "confirm", key: "confirm", params: { article: p.article, sap: p.sap } };
    }
  } else if (step.type === "resize") {
    const oldFaces = p.currentFaces;
    const oldWidth = widthOf(p);
    p.currentFaces = step.faces;
    const newWidth = widthOf(p);
    const delta = newWidth - oldWidth; // >0 grows (must "eat" the gap to its right), <0 shrinks (gap to its right grows)

    const idx = rs.items.findIndex((x) => (x as Product).index === p.index);
    if (idx !== -1) {
      const next = rs.items[idx + 1] as ShelfSlot | undefined;
      if (next && isGap(next)) {
        next.width -= delta;
        if (next.width < 0) next.width = 0; // guard against rounding error
      } else if (delta < 0) {
        // item shrinks and there's no gap right after it yet — create one
        rs.items.splice(idx + 1, 0, { __gap: true, width: -delta } satisfies GapMarker);
      }
      // if it grows (delta>0) and there's no gap to the right at all — shouldn't happen,
      // fillDeficit() in buildSteps already freed the space ahead of time
    }

    p.state = "correct";
    p._ti = step.ti;
    rs.cursor++;

    if (!silent) {
      state.navigator = {
        kind: "resize",
        key: step.faces > oldFaces ? "resizeIncrease" : "resizeDecrease",
        params: {
          article: p.article,
          sap: p.sap,
          rack: step.rack,
          shelf: step.shelf,
          newPos: p.positionNumberNew,
          oldFaces,
          newFaces: step.faces,
        },
      };
    }
  } else if (step.type === "place") {
    if (step.source === "tempBasket") {
      state.basket.temp = state.basket.temp.filter((x) => x.index !== p.index);
    } else if (step.source === "newBasket") {
      state.basket.new = state.basket.new.filter((x) => x.index !== p.index);
    } else if (step.source === "shelf") {
      removeFromOldShelf(state, p);
    }

    p.currentFaces = p.facesNew;
    p.state = "correct";

    insertByTi(rs, p, step.ti!, state.mirrored);
    rs.cursor++;

    if (!silent) {
      const baseParams = {
        article: p.article,
        sap: p.sap,
        rack: step.rack,
        shelf: step.shelf,
        newPos: p.positionNumberNew,
        faces: p.facesNew,
      };
      state.navigator =
        step.source === "tempBasket"
          ? { kind: "place", key: "placeFromTemp", params: baseParams }
          : step.source === "newBasket"
            ? { kind: "place", key: "placeFromNew", params: baseParams }
            : {
                kind: "place",
                key: "placeFromShelf",
                params: { ...baseParams, oldRack: p.rackOld, oldShelf: p.shelfOld },
              };
    }
  }
}

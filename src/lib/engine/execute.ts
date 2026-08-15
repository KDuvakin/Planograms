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
      rs.items.splice(i + 1, 1);
    }
  }
}

/**
 * Inserts an item at its target index (ti) — not "at the end", since with
 * recursive rearrangement items may not resolve strictly left to right. All
 * already-settled items carry `_ti` and are sorted by it first; the untouched
 * tail of the old layout (no `_ti`) always stays after them.
 */
function insertByTi(rs: ShelfState, item: Product, ti: number): void {
  const neededW = item.faceWidth * (item.facesNew || item.currentFaces || 0);

  let idx = rs.items.length;
  for (let i = 0; i < rs.items.length; i++) {
    const t = (rs.items[i] as Product)._ti;
    if (t === undefined || t > ti) {
      idx = i;
      break;
    }
  }

  // if a gap of sufficient (or larger) width already sits right at the boundary —
  // occupy it in place; any leftover stays right after it, and no untouched
  // neighbour ever shifts
  const here = rs.items[idx];
  if (here && isGap(here) && here.width >= neededW - RENDER_FIT_SLACK) {
    const leftover = here.width - neededW;
    rs.items[idx] = item;
    item._ti = ti;
    if (leftover > EPS_GAP) {
      rs.items.splice(idx + 1, 0, { __gap: true, width: leftover } satisfies GapMarker);
    }
    return;
  }

  // fallback: no local gap exactly here — insert at the boundary as before
  // (uses free space accumulated elsewhere on the shelf)
  rs.items.splice(idx, 0, item);
  item._ti = ti;
}

/** Removes a product from its OWN old shelf — used only when taking it "off the rack" onto another shelf, when it hasn't been touched yet. */
function removeFromOldShelf(state: EngineState, p: Product): void {
  const rs = state.racks[p.rackOld]?.[p.shelfOld];
  if (!rs) return;
  const idx = rs.items.findIndex((x) => (x as Product).index === p.index);
  if (idx !== -1) rs.items[idx] = { __gap: true, width: widthOf(p) } satisfies GapMarker;
  coalesceGaps(rs);
}

/** Applies one step to the live racks/basket state. `silent` steps skip generating navigator text (used when fast-forwarding through absorbed steps). */
export function execute(state: EngineState, step: Step, silent: boolean): void {
  const p = step.product;
  const rs = ensureShelf(state, step.rack, step.shelf);

  if (step.type === "evict") {
    const idx = rs.items.findIndex((x) => (x as Product).index === p.index);
    if (idx !== -1) rs.items[idx] = { __gap: true, width: widthOf(p) } satisfies GapMarker;
    coalesceGaps(rs);

    if (step.to === "deleted") {
      if (!state.basket.deleted.find((x) => x.index === p.index)) state.basket.deleted.push(p);
      p.state = "deleted";
      if (!silent) {
        state.navigator = {
          kind: "delete",
          key: "delete",
          params: { article: p.article, sap: p.sap, rack: step.rack, shelf: step.shelf },
        };
      }
    } else {
      if (!state.basket.temp.find((x) => x.index === p.index)) state.basket.temp.push(p);
      p.state = "temp";
      if (!silent) {
        state.navigator = {
          kind: "pick",
          key: "pick",
          params: { article: p.article, sap: p.sap, rack: step.rack, shelf: step.shelf },
        };
      }
    }
  } else if (step.type === "move") {
    const fromRs = ensureShelf(state, step.fromRack, step.fromShelf);
    const idx = fromRs.items.findIndex((x) => (x as Product).index === p.index);
    if (idx !== -1) fromRs.items[idx] = { __gap: true, width: widthOf(p) } satisfies GapMarker;
    coalesceGaps(fromRs);

    const sameShelf = step.fromRack === step.rack && step.fromShelf === step.shelf;
    const oldPos = p.positionNumberOld;

    p.currentFaces = p.facesNew;
    p.state = "correct";

    insertByTi(rs, p, step.ti!);
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

    insertByTi(rs, p, step.ti!);
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

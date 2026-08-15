import type { EngineState, Product } from "./types";

/** Lays the OLD state onto shelves (step 0) and classifies each product's initial state. */
export function buildInitial(state: EngineState): void {
  state.racks = {};
  state.basket = { deleted: [], new: [], temp: [] };

  state.products.forEach((p) => {
    p._ti = undefined; // clear "already settled" marker from a previous run (e.g. Reset/Back)

    if (p.isNew) {
      p.state = "new";
      p.currentFaces = p.facesNew;
      state.basket.new.push(p);
      return;
    }

    const r = p.rackOld;
    const s = p.shelfOld;
    p.currentFaces = p.facesOld; // reset — a re-run (Back/Reset) may have left the NEW value here
    if (!state.racks[r]) state.racks[r] = {};
    if (!state.racks[r][s]) state.racks[r][s] = { items: [], cursor: 0 };
    state.racks[r][s].items.push(p);

    if (p.isDeleted) {
      p.state = "deleted";
      return;
    }

    if (
      p.rackOld === p.rackNew &&
      p.shelfOld === p.shelfNew &&
      p.positionNumberOld === p.positionNumberNew &&
      p.facesOld === p.facesNew
    ) {
      p.state = "correct";
    } else {
      p.state = "move";
    }
  });

  // sort each shelf by old position number — that's how it physically stands right now
  Object.keys(state.racks).forEach((r) => {
    Object.keys(state.racks[r]).forEach((s) => {
      state.racks[r][s].items.sort((a, b) => {
        const ap = a as Product;
        const bp = b as Product;
        return (parseInt(ap.positionNumberOld, 10) || 0) - (parseInt(bp.positionNumberOld, 10) || 0);
      });
    });
  });

  // also create racks/shelves that exist only in the NEW layout, so new products have somewhere to render
  state.products
    .filter((p) => !p.isDeleted)
    .forEach((p) => {
      const r = p.rackNew;
      const s = p.shelfNew;
      if (!state.racks[r]) state.racks[r] = {};
      if (!state.racks[r][s]) state.racks[r][s] = { items: [], cursor: 0 };
    });
}

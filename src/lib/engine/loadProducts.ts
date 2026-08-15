import type { StitchedItem } from "./stitch";
import type { Product } from "./types";

/** Shape items arrive in from the API — a stored PlanogramItem, in sortIndex order. */
export interface PlanogramItemLike extends StitchedItem {
  id: string;
}

export function loadProducts(items: PlanogramItemLike[]): Product[] {
  return items.map((item, index) => ({
    index,
    id: item.id,
    sap: item.sap,
    ean: item.ean,
    article: item.article,

    rackOld: item.rackOld,
    shelfOld: item.shelfOld,
    positionNumberOld: item.positionNumberOld,
    facesOld: item.facesOld,

    rackNew: item.rackNew,
    shelfNew: item.shelfNew,
    positionNumberNew: item.positionNumberNew,
    facesNew: item.facesNew,

    faceWidth: item.faceWidth,
    isNew: item.isNew,
    isDeleted: item.isDeleted,

    currentFaces: 0,
    state: "move",
    _ti: undefined,
  }));
}

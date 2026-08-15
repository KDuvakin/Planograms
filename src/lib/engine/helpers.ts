import type { Product } from "./types";

export function widthOf(p: Product): number {
  return p.faceWidth * (p.currentFaces || p.facesOld || 0);
}

export function neededWidthOf(p: Product): number {
  return p.faceWidth * (p.facesNew || p.facesOld || 0);
}

/** A product whose rack/shelf/position number never changed — never physically touched unless forced. */
export function isAnchor(p: Product): boolean {
  return (
    !p.isNew &&
    !p.isDeleted &&
    p.rackOld === p.rackNew &&
    p.shelfOld === p.shelfNew &&
    p.positionNumberOld === p.positionNumberNew
  );
}

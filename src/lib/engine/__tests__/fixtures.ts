import type { RawExcelRow } from "../stitch";
import { stitchNodeRows } from "../stitch";
import { loadProducts } from "../loadProducts";
import type { Product } from "../types";

interface RowOpts {
  ean?: string;
  article?: string;
  unitOrTray?: "Unit" | "Tray";
}

/**
 * Builds one raw Excel row exactly like a real export: `faceWidthCm` is the
 * width of a single face. For "Unit" rows, "Position Width" (total width for
 * ALL faces) is derived as faceWidthCm * faces, matching faceWidthOf()'s
 * expectation. For "Tray" rows, "Product Tray Width" is faceWidthCm directly.
 */
export function row(
  sap: string,
  status: "Old" | "New",
  rack: string,
  shelf: string,
  pos: string,
  faces: number,
  faceWidthCm: number,
  opts: RowOpts = {}
): RawExcelRow {
  const unitOrTray = opts.unitOrTray ?? "Unit";
  return {
    Node: "TEST",
    SAP: sap,
    EAN: opts.ean ?? `EAN-${sap}`,
    Article: opts.article ?? `Товар ${sap}`,
    Rack: rack,
    Shelf: shelf,
    "Position number": pos,
    Status: status,
    Faces: faces,
    "Unit or Tray": unitOrTray,
    "Position Width": unitOrTray === "Unit" ? faceWidthCm * faces : undefined,
    "Product Tray Width": unitOrTray === "Tray" ? faceWidthCm : undefined,
  };
}

export function buildTestProducts(rows: RawExcelRow[]): { products: Product[]; duplicates: string[] } {
  const { items, duplicates } = stitchNodeRows(rows);
  const products = loadProducts(items.map((item, i) => ({ ...item, id: `item-${i}` })));
  return { products, duplicates };
}

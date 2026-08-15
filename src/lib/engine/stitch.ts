import { faceWidthOf, type RawPositionRow } from "./faceWidth";

/**
 * One raw row from the source Excel file — one state (Old or New) of one
 * product position. Shared shape used by both the Excel import route and
 * engine tests (as fixture data), so fixtures look exactly like real rows.
 */
export interface RawExcelRow extends RawPositionRow {
  Node?: string;
  SAP?: string | number;
  EAN?: string | number;
  Article?: string;
  Rack?: string | number;
  Shelf?: string | number;
  "Position number"?: string | number;
  Status?: string;
}

/** One SAP's Old+New rows stitched into a single record — the shape stored as a PlanogramItem. */
export interface StitchedItem {
  sap: string;
  ean: string | null;
  article: string;

  rackOld: string;
  shelfOld: string;
  positionNumberOld: string;
  facesOld: number;
  unitOrTrayOld: string | null;
  positionWidthOld: number | null;
  productTrayWidthOld: number | null;

  rackNew: string;
  shelfNew: string;
  positionNumberNew: string;
  facesNew: number;
  unitOrTrayNew: string | null;
  positionWidthNew: number | null;
  productTrayWidthNew: number | null;

  faceWidth: number;
  isNew: boolean;
  isDeleted: boolean;
}

export interface StitchResult {
  items: StitchedItem[];
  /** SAP+Status combos that appeared more than once — last row silently wins, previous ones are reported here. */
  duplicates: string[];
}

/**
 * Stitches Old/New rows for a single Node into one product record per SAP.
 * `rows` must already be filtered to one Node — callers processing a whole
 * workbook should group by Node once, then call this per group.
 */
export function stitchNodeRows(rows: RawExcelRow[]): StitchResult {
  const oldBySap = new Map<string, RawExcelRow>();
  const newBySap = new Map<string, RawExcelRow>();
  const duplicates: string[] = [];

  for (const row of rows) {
    const sap = String(row.SAP ?? "").trim();
    if (!sap) continue;
    const status = String(row.Status ?? "").trim().toLowerCase();
    if (status === "old") {
      if (oldBySap.has(sap)) duplicates.push(`${sap} (Old)`);
      oldBySap.set(sap, row);
    } else if (status === "new") {
      if (newBySap.has(sap)) duplicates.push(`${sap} (New)`);
      newBySap.set(sap, row);
    }
  }

  // old-side SAPs first (in first-seen order), then any new-only SAPs — matches the prototype's Set-dedupe order.
  const allSaps = Array.from(new Set([...oldBySap.keys(), ...newBySap.keys()]));

  const items: StitchedItem[] = allSaps.map((sap) => {
    const o = oldBySap.get(sap);
    const n = newBySap.get(sap);
    const ref = n ?? o!;

    const item: StitchedItem = {
      sap,
      ean: ref.EAN != null && ref.EAN !== "" ? String(ref.EAN) : null,
      article: String(ref.Article ?? ""),

      rackOld: "new",
      shelfOld: "new",
      positionNumberOld: "new",
      facesOld: 0,
      unitOrTrayOld: null,
      positionWidthOld: null,
      productTrayWidthOld: null,

      rackNew: "Deleted",
      shelfNew: "Deleted",
      positionNumberNew: "Deleted",
      facesNew: 0,
      unitOrTrayNew: null,
      positionWidthNew: null,
      productTrayWidthNew: null,

      faceWidth: 0,
      isNew: !o,
      isDeleted: !n,
    };

    if (o) {
      item.rackOld = String(o.Rack ?? "");
      item.shelfOld = String(o.Shelf ?? "");
      item.positionNumberOld = String(o["Position number"] ?? "");
      item.facesOld = parseInt(String(o.Faces), 10) || 0;
      item.unitOrTrayOld = o["Unit or Tray"] != null ? String(o["Unit or Tray"]) : null;
      item.positionWidthOld = o["Position Width"] != null ? parseFloat(String(o["Position Width"])) : null;
      item.productTrayWidthOld =
        o["Product Tray Width"] != null ? parseFloat(String(o["Product Tray Width"])) : null;
    }

    if (n) {
      item.rackNew = String(n.Rack ?? "");
      item.shelfNew = String(n.Shelf ?? "");
      item.positionNumberNew = String(n["Position number"] ?? "");
      item.facesNew = parseInt(String(n.Faces), 10) || 0;
      item.unitOrTrayNew = n["Unit or Tray"] != null ? String(n["Unit or Tray"]) : null;
      item.positionWidthNew = n["Position Width"] != null ? parseFloat(String(n["Position Width"])) : null;
      item.productTrayWidthNew =
        n["Product Tray Width"] != null ? parseFloat(String(n["Product Tray Width"])) : null;
    }

    // face width shouldn't change between old/new state — prefer the new row.
    item.faceWidth = faceWidthOf(n) || faceWidthOf(o);

    return item;
  });

  return { items, duplicates };
}

/** Distinct, trimmed, non-empty Node values present in a raw workbook sheet. */
export function distinctNodes(rows: RawExcelRow[]): string[] {
  return Array.from(new Set(rows.map((r) => String(r.Node ?? "").trim()).filter(Boolean)));
}

export function groupRowsByNode(rows: RawExcelRow[]): Map<string, RawExcelRow[]> {
  const byNode = new Map<string, RawExcelRow[]>();
  for (const row of rows) {
    const node = String(row.Node ?? "").trim();
    if (!node) continue;
    const group = byNode.get(node);
    if (group) group.push(row);
    else byNode.set(node, [row]);
  }
  return byNode;
}

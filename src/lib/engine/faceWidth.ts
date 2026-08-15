/** One side (Old or New) of a raw Excel position row, as parsed by SheetJS. */
export interface RawPositionRow {
  "Unit or Tray"?: string;
  Faces?: number | string;
  "Position Width"?: number | string;
  "Product Tray Width"?: number | string;
}

/**
 * Width of a single face/tray, in cm.
 * "Tray" -> Product Tray Width is already the width of one face.
 * "Unit" -> Position Width is the width for ALL faces combined, divide by Faces.
 */
export function faceWidthOf(row: RawPositionRow | null | undefined): number {
  if (!row) return 0;
  const type = String(row["Unit or Tray"] ?? "").trim().toLowerCase();
  const faces = parseFloat(String(row.Faces)) || 1;
  if (type === "tray") {
    return parseFloat(String(row["Product Tray Width"])) || 0;
  }
  const posWidth = parseFloat(String(row["Position Width"])) || 0;
  return faces ? posWidth / faces : posWidth;
}

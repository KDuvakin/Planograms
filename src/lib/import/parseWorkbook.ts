import * as XLSX from "xlsx";
import type { RawExcelRow } from "@/lib/engine";

/**
 * Parses the first sheet of an uploaded planogram workbook into raw rows.
 * Real exports have trailing whitespace on some headers (e.g. "Shelf ") —
 * trimmed here exactly like the original prototype's loadWorkbook() did, or
 * those columns silently come through as undefined.
 */
export function parseWorkbookRows(buffer: Buffer): RawExcelRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const parsed = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  return parsed.map((r) => {
    const clean: Record<string, unknown> = {};
    Object.keys(r).forEach((k) => {
      clean[k.trim()] = r[k];
    });
    return clean as RawExcelRow;
  });
}

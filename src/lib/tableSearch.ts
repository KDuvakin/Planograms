/** Case-insensitive substring match across whichever fields a row exposes — the same
 * one-box "search everything" pattern used by every admin table. */
export function filterRows<T>(
  rows: T[] | undefined,
  query: string,
  getFields: (row: T) => Array<string | null | undefined>
): T[] {
  if (!rows) return [];
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) => getFields(row).some((field) => field?.toLowerCase().includes(q)));
}

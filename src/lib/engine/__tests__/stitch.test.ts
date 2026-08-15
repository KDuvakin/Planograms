import { describe, expect, it } from "vitest";
import { faceWidthOf } from "../faceWidth";
import { stitchNodeRows } from "../stitch";
import { row } from "./fixtures";

describe("faceWidthOf", () => {
  it("divides Position Width by Faces for Unit rows", () => {
    expect(faceWidthOf({ "Unit or Tray": "Unit", Faces: 2, "Position Width": 20 })).toBe(10);
  });

  it("uses Product Tray Width directly for Tray rows", () => {
    expect(faceWidthOf({ "Unit or Tray": "Tray", Faces: 3, "Product Tray Width": 7.5 })).toBe(7.5);
  });

  it("returns 0 for a missing row", () => {
    expect(faceWidthOf(null)).toBe(0);
    expect(faceWidthOf(undefined)).toBe(0);
  });
});

describe("stitchNodeRows", () => {
  it("stitches an Old+New pair into one product", () => {
    const rows = [
      row("100", "Old", "1", "1", "1", 2, 10),
      row("100", "New", "1", "2", "3", 3, 10),
    ];
    const { items, duplicates } = stitchNodeRows(rows);
    expect(duplicates).toEqual([]);
    expect(items).toHaveLength(1);
    const item = items[0];
    expect(item.sap).toBe("100");
    expect(item.rackOld).toBe("1");
    expect(item.shelfOld).toBe("1");
    expect(item.positionNumberOld).toBe("1");
    expect(item.facesOld).toBe(2);
    expect(item.rackNew).toBe("1");
    expect(item.shelfNew).toBe("2");
    expect(item.positionNumberNew).toBe("3");
    expect(item.facesNew).toBe(3);
    expect(item.faceWidth).toBe(10);
    expect(item.isNew).toBe(false);
    expect(item.isDeleted).toBe(false);
  });

  it("marks Old-only rows as deleted, with Rack/Shelf/Position = Deleted", () => {
    const rows = [row("200", "Old", "1", "1", "1", 1, 10)];
    const { items } = stitchNodeRows(rows);
    expect(items[0].isDeleted).toBe(true);
    expect(items[0].isNew).toBe(false);
    expect(items[0].rackNew).toBe("Deleted");
    expect(items[0].shelfNew).toBe("Deleted");
    expect(items[0].positionNumberNew).toBe("Deleted");
  });

  it("marks New-only rows as new, with Rack/Shelf/Position old = 'new'", () => {
    const rows = [row("300", "New", "1", "1", "1", 1, 10)];
    const { items } = stitchNodeRows(rows);
    expect(items[0].isNew).toBe(true);
    expect(items[0].isDeleted).toBe(false);
    expect(items[0].rackOld).toBe("new");
    expect(items[0].shelfOld).toBe("new");
    expect(items[0].positionNumberOld).toBe("new");
  });

  it("prefers the New row's face width, falling back to Old", () => {
    const rows = [
      row("400", "Old", "1", "1", "1", 1, 10),
      row("400", "New", "1", "1", "2", 1, 15),
    ];
    const { items } = stitchNodeRows(rows);
    expect(items[0].faceWidth).toBe(15);
  });

  it("reports duplicate SAP+Status rows and keeps the last one", () => {
    const rows = [
      row("500", "Old", "1", "1", "1", 1, 10),
      row("500", "Old", "1", "1", "9", 5, 10), // duplicate Old for SAP 500 — this one wins
    ];
    const { items, duplicates } = stitchNodeRows(rows);
    expect(duplicates).toEqual(["500 (Old)"]);
    expect(items).toHaveLength(1);
    expect(items[0].positionNumberOld).toBe("9");
    expect(items[0].facesOld).toBe(5);
  });

  it("ignores rows with no SAP", () => {
    const rows = [row("", "Old", "1", "1", "1", 1, 10)];
    expect(stitchNodeRows(rows).items).toHaveLength(0);
  });
});

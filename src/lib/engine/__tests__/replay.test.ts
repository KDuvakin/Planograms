import { describe, expect, it } from "vitest";
import { createEngineState, isGap } from "../index";
import { nextStep, prevStep, resetAll, seekToRealStep } from "../controls";
import type { PlanogramItemLike } from "../loadProducts";
import { stitchNodeRows } from "../stitch";
import { row } from "./fixtures";

function items(rows: ReturnType<typeof row>[]): PlanogramItemLike[] {
  const { items } = stitchNodeRows(rows);
  return items.map((item, i) => ({ ...item, id: `item-${i}` }));
}

const SWAP_ROWS = [
  row("A", "Old", "1", "1", "1", 1, 10),
  row("A", "New", "1", "1", "2", 1, 10),
  row("B", "Old", "1", "1", "2", 1, 10),
  row("B", "New", "1", "1", "1", 1, 10),
];

describe("nextStep / prevStep", () => {
  it("walks forward one real step at a time and produces navigator text for each", () => {
    const state = createEngineState(items(SWAP_ROWS));
    expect(state.realStepsTotal).toBe(3);
    expect(state.currentRealStep).toBe(0);

    nextStep(state);
    expect(state.currentRealStep).toBe(1);
    expect(state.navigator.kind).toBe("pick");
    expect(state.navigator.key).toBe("pick");
    expect(state.navigator.params?.sap).toBe("A");
    expect(state.basket.temp.map((p) => p.sap)).toEqual(["A"]);

    nextStep(state);
    expect(state.currentRealStep).toBe(2);
    expect(state.navigator.kind).toBe("move");
    expect(state.racks["1"]["1"].items.some((i) => "sap" in i && i.sap === "B")).toBe(true);

    nextStep(state);
    expect(state.currentRealStep).toBe(3);
    expect(state.navigator.kind).toBe("done");
    expect(state.basket.temp).toHaveLength(0); // A was taken back out of the basket

    // no-op once finished
    nextStep(state);
    expect(state.currentRealStep).toBe(3);
  });

  it("prevStep replays from scratch back to the previous real step, reproducing identical state", () => {
    const state = createEngineState(items(SWAP_ROWS));
    nextStep(state);
    nextStep(state);
    nextStep(state); // fully done

    prevStep(state);
    expect(state.currentRealStep).toBe(2);
    expect(state.navigator.kind).toBe("move");

    prevStep(state);
    expect(state.currentRealStep).toBe(1);
    expect(state.navigator.kind).toBe("pick");

    prevStep(state);
    expect(state.currentRealStep).toBe(0);
    expect(state.navigator.kind).toBe("idle");

    // no-op at the start
    prevStep(state);
    expect(state.currentRealStep).toBe(0);
  });

  it("resetAll recomputes the plan and returns to the idle state", () => {
    const state = createEngineState(items(SWAP_ROWS));
    nextStep(state);
    resetAll(state);
    expect(state.currentRealStep).toBe(0);
    expect(state.currentStep).toBe(0);
    expect(state.navigator.kind).toBe("idle");
    expect(state.basket.temp).toHaveLength(0);
  });
});

describe("gap identity after coalescing", () => {
  // F is an anchor at pos1; G and H (both discontinued) sit right after it at pos2/pos3
  // and get evicted back to back — their gaps end up adjacent and merge into one.
  it("keeps both evicted products' identity so the UI can still highlight whichever one is the current step", () => {
    const rows = [
      row("F", "Old", "1", "1", "1", 1, 10),
      row("F", "New", "1", "1", "1", 1, 10),
      row("G", "Old", "1", "1", "2", 1, 10), // deleted — no New row
      row("H", "Old", "1", "1", "3", 1, 10), // deleted — no New row
    ];
    const state = createEngineState(items(rows));
    nextStep(state); // evicts G (F's confirm silently folds into this click)
    nextStep(state); // evicts H — its gap merges with G's adjacent gap

    const gIndex = state.basket.deleted.find((p) => p.sap === "G")!.index;
    const hIndex = state.basket.deleted.find((p) => p.sap === "H")!.index;

    const gap = state.racks["1"]["1"].items.find(isGap);
    expect(gap?.fromProductIndexes).toEqual(expect.arrayContaining([gIndex, hIndex]));
  });
});

describe("seekToRealStep", () => {
  it("jumping straight to a step produces the same state as stepping there one click at a time", () => {
    const stepped = createEngineState(items(SWAP_ROWS));
    nextStep(stepped);
    nextStep(stepped);

    const seeked = createEngineState(items(SWAP_ROWS));
    seekToRealStep(seeked, 2);

    expect(seeked.currentRealStep).toBe(stepped.currentRealStep);
    expect(seeked.navigator).toEqual(stepped.navigator);
    expect(seeked.basket.temp.map((p) => p.sap)).toEqual(stepped.basket.temp.map((p) => p.sap));

    const flatten = (s: typeof stepped) =>
      Object.entries(s.racks).flatMap(([rack, shelves]) =>
        Object.entries(shelves).flatMap(([shelf, rs]) =>
          rs.items.map((it) => ("sap" in it ? `${rack}/${shelf}:${it.sap}:${it.currentFaces}` : `${rack}/${shelf}:gap`))
        )
      );
    expect(flatten(seeked)).toEqual(flatten(stepped));
  });

  it("clamps out-of-range targets", () => {
    const state = createEngineState(items(SWAP_ROWS));
    seekToRealStep(state, 999);
    expect(state.currentRealStep).toBe(state.realStepsTotal);
    expect(state.navigator.kind).toBe("done");

    seekToRealStep(state, -5);
    expect(state.currentRealStep).toBe(0);
    expect(state.navigator.kind).toBe("idle");
  });
});

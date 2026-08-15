import { describe, expect, it } from "vitest";
import { buildInitial } from "../buildInitial";
import { buildSteps } from "../buildSteps";
import type { EngineState, Step } from "../types";
import { buildTestProducts, row } from "./fixtures";

function makeState(rows: ReturnType<typeof row>[]): EngineState {
  const { products } = buildTestProducts(rows);
  const state: EngineState = {
    products,
    racks: {},
    basket: { deleted: [], new: [], temp: [] },
    steps: [],
    clickBoundaries: [0],
    realStepsTotal: 0,
    currentStep: 0,
    currentRealStep: 0,
    navigator: { kind: "idle", key: "idle" },
  };
  buildInitial(state);
  buildSteps(state);
  return state;
}

function types(steps: Step[]): string[] {
  return steps.map((s) => s.type);
}

describe("buildSteps — anchors", () => {
  it("an untouched product produces a silent confirm step, not counted as a real step", () => {
    const state = makeState([
      row("1", "Old", "1", "1", "1", 2, 10),
      row("1", "New", "1", "1", "1", 2, 10), // identical rack/shelf/position/faces
    ]);
    expect(types(state.steps)).toEqual(["confirm"]);
    expect(state.realStepsTotal).toBe(0);
  });

  it("an anchor whose face count changes produces one resize step", () => {
    const state = makeState([
      row("1", "Old", "1", "1", "1", 2, 5), // width 10
      row("1", "New", "1", "1", "1", 3, 5), // width 15, same position -> still an anchor
    ]);
    expect(types(state.steps)).toEqual(["resize"]);
    expect(state.realStepsTotal).toBe(1);
    const step = state.steps[0];
    if (step.type === "resize") expect(step.faces).toBe(3);
  });
});

describe("buildSteps — deleted and new products", () => {
  it("a product with no New row is evicted to the deleted basket", () => {
    const state = makeState([row("1", "Old", "1", "1", "1", 1, 10)]);
    expect(types(state.steps)).toEqual(["evict"]);
    expect(state.realStepsTotal).toBe(1);
    const step = state.steps[0];
    if (step.type === "evict") expect(step.to).toBe("deleted");
  });

  it("a product with no Old row is placed from the new-product basket", () => {
    const state = makeState([row("1", "New", "1", "1", "1", 1, 10)]);
    expect(types(state.steps)).toEqual(["place"]);
    expect(state.realStepsTotal).toBe(1);
    const step = state.steps[0];
    if (step.type === "place") expect(step.source).toBe("newBasket");
  });
});

describe("buildSteps — two-item position swap on the same shelf", () => {
  // A sits at pos1, B at pos2; the new layout wants them swapped.
  it("evicts one item, moves the other into place, then places the first from the temp basket", () => {
    const state = makeState([
      row("A", "Old", "1", "1", "1", 1, 10),
      row("A", "New", "1", "1", "2", 1, 10),
      row("B", "Old", "1", "1", "2", 1, 10),
      row("B", "New", "1", "1", "1", 1, 10),
    ]);
    expect(types(state.steps)).toEqual(["evict", "move", "place"]);
    expect(state.realStepsTotal).toBe(3);

    const [evictStep, moveStep, placeStep] = state.steps;
    if (evictStep.type === "evict") {
      expect(evictStep.product.sap).toBe("A");
      expect(evictStep.to).toBe("temp");
    }
    if (moveStep.type === "move") expect(moveStep.product.sap).toBe("B");
    if (placeStep.type === "place") {
      expect(placeStep.product.sap).toBe("A");
      expect(placeStep.source).toBe("tempBasket");
    }
  });
});

describe("buildSteps — adjacent evict+place merges into a single move", () => {
  it("merges a cross-shelf evict immediately followed by a place of the same item", () => {
    // Shelf 1: X is an anchor (stays), K moves away to shelf 2 — K ends up being the
    // very last thing evicted from shelf 1, and the very first thing placed on shelf 2,
    // with nothing else in between, so it should collapse into one "move".
    const state = makeState([
      row("X", "Old", "1", "1", "1", 1, 10),
      row("X", "New", "1", "1", "1", 1, 10),
      row("K", "Old", "1", "1", "2", 1, 10),
      row("K", "New", "1", "2", "1", 1, 10),
    ]);
    expect(types(state.steps)).toEqual(["confirm", "move"]);
    expect(state.realStepsTotal).toBe(1);
    const moveStep = state.steps[1];
    if (moveStep.type === "move") {
      expect(moveStep.product.sap).toBe("K");
      expect(moveStep.fromShelf).toBe("1");
      expect(moveStep.shelf).toBe("2");
    }
  });
});

describe("buildSteps — forced eviction chain", () => {
  // F is an anchor at pos1. G and H (both discontinued) sit at pos2/pos3 and must
  // both be evicted to free enough width for a wide new product J at pos2.
  it("evicts every blocking product needed to fit the incoming item", () => {
    const state = makeState([
      row("F", "Old", "1", "1", "1", 1, 10),
      row("F", "New", "1", "1", "1", 1, 10),
      row("G", "Old", "1", "1", "2", 1, 10), // deleted — no New row
      row("H", "Old", "1", "1", "3", 1, 10), // deleted — no New row
      row("J", "New", "1", "1", "2", 4, 5), // new — needs width 20
    ]);
    expect(types(state.steps)).toEqual(["confirm", "evict", "evict", "place"]);
    expect(state.realStepsTotal).toBe(3);

    const evictedSaps = state.steps.filter((s) => s.type === "evict").map((s) => s.product.sap);
    expect(evictedSaps.sort()).toEqual(["G", "H"]);

    const placeStep = state.steps[3];
    if (placeStep.type === "place") {
      expect(placeStep.product.sap).toBe("J");
      expect(placeStep.source).toBe("newBasket");
    }
  });
});

describe("buildSteps — moving to a different rack", () => {
  it("produces a single move step with correct from/to rack and shelf", () => {
    const state = makeState([
      row("1", "Old", "1", "1", "1", 1, 10),
      row("1", "New", "2", "3", "1", 1, 10),
    ]);
    expect(types(state.steps)).toEqual(["move"]);
    const step = state.steps[0];
    if (step.type === "move") {
      expect(step.fromRack).toBe("1");
      expect(step.fromShelf).toBe("1");
      expect(step.rack).toBe("2");
      expect(step.shelf).toBe("3");
    }
  });
});

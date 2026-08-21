export * from "./types";
export * from "./helpers";
export * from "./faceWidth";
export * from "./stitch";
export * from "./loadProducts";
export * from "./buildInitial";
export * from "./buildSteps";
export * from "./execute";
export * from "./controls";
export * from "./selectors";

import type { EngineState } from "./types";
import type { PlanogramItemLike } from "./loadProducts";
import { loadProducts } from "./loadProducts";
import { buildInitial } from "./buildInitial";
import { buildSteps } from "./buildSteps";

/** Builds a fresh EngineState from stored items — step 0, full plan computed. */
export function createEngineState(items: PlanogramItemLike[], mirrored = false): EngineState {
  const state: EngineState = {
    products: loadProducts(items),
    racks: {},
    basket: { deleted: [], new: [], temp: [] },
    mirrored,
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

import { create } from "zustand";
import type { EngineState } from "./types";
import { createEngineState } from "./index";
import type { PlanogramItemLike } from "./loadProducts";
import {
  nextStep as engineNextStep,
  prevStep as enginePrevStep,
  resetAll as engineResetAll,
  seekToRealStep as engineSeekToRealStep,
} from "./controls";

export interface RunState extends EngineState {
  hideCompletedRacks: boolean;
  nextStep: () => void;
  prevStep: () => void;
  resetAll: () => void;
  seekToRealStep: (n: number) => void;
  toggleHideCompleted: () => void;
}

/**
 * Each run page creates its OWN store instance (via `useState(() => createRunStore(items))`)
 * rather than a module-level singleton — every planogram run has independent state.
 *
 * The ported engine functions (nextStep/prevStep/buildInitial/...) mutate their EngineState
 * argument in place — that's how the algorithm preserves shared object identity between
 * `products`, `racks`, `basket`, and `steps[].product` (all point at the same Product
 * instances, exactly like the original prototype relied on). We deliberately do NOT wrap
 * this in Immer: Immer would draft/clone the state tree, and re-establishing "the same
 * object referenced from three different places" through Immer's proxy machinery is an
 * avoidable risk when plain mutation + a shallow top-level copy gets React the same
 * "state changed" signal with zero ambiguity about identity.
 */
export function createRunStore(items: PlanogramItemLike[], initialRealStep = 0) {
  const initial = createEngineState(items);
  if (initialRealStep > 0) {
    engineSeekToRealStep(initial, initialRealStep);
  }

  return create<RunState>((set) => ({
    ...initial,
    hideCompletedRacks: false,
    nextStep: () =>
      set((s) => {
        engineNextStep(s);
        return { ...s };
      }),
    prevStep: () =>
      set((s) => {
        enginePrevStep(s);
        return { ...s };
      }),
    resetAll: () =>
      set((s) => {
        engineResetAll(s);
        return { ...s };
      }),
    seekToRealStep: (n: number) =>
      set((s) => {
        engineSeekToRealStep(s, n);
        return { ...s };
      }),
    toggleHideCompleted: () => set((s) => ({ hideCompletedRacks: !s.hideCompletedRacks })),
  }));
}

export type RunStore = ReturnType<typeof createRunStore>;

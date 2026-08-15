import type { EngineState } from "./types";
import { buildInitial } from "./buildInitial";
import { buildSteps } from "./buildSteps";
import { execute } from "./execute";

/** One click = exactly one real action. "Already in place" steps require no click — they're silently executed on the way to the next real action. */
export function nextStep(state: EngineState): void {
  if (state.currentRealStep >= state.realStepsTotal) return;

  const from = state.currentStep;
  state.currentRealStep++;
  state.currentStep = state.clickBoundaries[state.currentRealStep];

  for (let i = from; i < state.currentStep; i++) {
    const isLast = i === state.currentStep - 1;
    execute(state, state.steps[i], !isLast); // render/announce text only for the final real action
  }

  if (state.currentRealStep >= state.realStepsTotal) {
    state.navigator = { kind: "done", key: "done" };
  }
}

/** Replays from scratch (buildInitial + re-execute 0..N) rather than undoing — cheap because the plan is deterministic. */
export function prevStep(state: EngineState): void {
  if (state.currentRealStep <= 0) return;

  state.currentRealStep--;
  state.currentStep = state.clickBoundaries[state.currentRealStep];

  buildInitial(state);
  for (let i = 0; i < state.currentStep; i++) {
    const isLast = i === state.currentStep - 1;
    execute(state, state.steps[i], !isLast); // play the last one non-silently so the navigator updates
  }

  if (state.currentStep === 0) {
    state.navigator = { kind: "idle", key: "idle" };
  }
}

/**
 * Fast-forwards (or rewinds) straight to an arbitrary real-step count — the
 * same replay trick prevStep() uses, generalized. Used to resume a run from
 * a `currentRealStep` persisted on the backend.
 */
export function seekToRealStep(state: EngineState, targetRealStep: number): void {
  const clamped = Math.max(0, Math.min(targetRealStep, state.realStepsTotal));
  state.currentRealStep = clamped;
  state.currentStep = state.clickBoundaries[clamped];

  buildInitial(state);
  for (let i = 0; i < state.currentStep; i++) {
    const isLast = i === state.currentStep - 1;
    execute(state, state.steps[i], !isLast);
  }

  if (state.currentStep === 0) {
    state.navigator = { kind: "idle", key: "idle" };
  } else if (state.currentRealStep >= state.realStepsTotal) {
    state.navigator = { kind: "done", key: "done" };
  }
}

export function resetAll(state: EngineState): void {
  state.currentStep = 0;
  state.currentRealStep = 0;
  buildInitial(state);
  buildSteps(state);
  state.navigator = { kind: "idle", key: "idle" };
}

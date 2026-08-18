import type { EngineState } from "./types";

export function rackNumbers(state: EngineState): string[] {
  return Object.keys(state.racks).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
}

export function shelfNumbers(state: EngineState, rack: string): string[] {
  return Object.keys(state.racks[rack] ?? {}).sort((a, b) => parseInt(b, 10) - parseInt(a, 10)); // 7 -> 1, top to bottom
}

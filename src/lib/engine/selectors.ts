import { isGap, type EngineState } from "./types";

export function rackNumbers(state: EngineState): string[] {
  return Object.keys(state.racks).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
}

export function shelfNumbers(state: EngineState, rack: string): string[] {
  return Object.keys(state.racks[rack] ?? {}).sort((a, b) => parseInt(b, 10) - parseInt(a, 10)); // 7 -> 1, top to bottom
}

/**
 * Racks that need any physical work at all (a move/removal already sitting on them, or a
 * new item destined for them) — everything else is untouched, "correct" as-is. Drives the
 * rack-tab coloring on the pre-run diff screen so staff can jump straight to what changed.
 */
export function racksWithChanges(state: EngineState): Set<string> {
  const changed = new Set<string>();
  for (const rack of Object.keys(state.racks)) {
    for (const shelf of Object.keys(state.racks[rack])) {
      if (state.racks[rack][shelf].items.some((slot) => !isGap(slot) && slot.state !== "correct")) {
        changed.add(rack);
        break;
      }
    }
  }
  for (const p of state.basket.new) {
    changed.add(p.rackNew);
  }
  return changed;
}

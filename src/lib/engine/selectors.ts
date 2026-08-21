import { isGap, type EngineState } from "./types";

export function rackNumbers(state: EngineState): string[] {
  return Object.keys(state.racks).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
}

export function shelfNumbers(state: EngineState, rack: string): string[] {
  return Object.keys(state.racks[rack] ?? {}).sort((a, b) => parseInt(b, 10) - parseInt(a, 10)); // 7 -> 1, top to bottom
}

/**
 * Renumbers a rack for display when the planogram is mirrored — the first true rack swaps
 * with the last, the second with the second-to-last, and so on (rack 3 of 5 stays put).
 * `allRacksAscending` must be the full true rack list (rackNumbers(state)). This never
 * touches the underlying data, the step order, or the instruction logic — only the label
 * shown to the user, everywhere a rack number is displayed (tabs, headings, instruction
 * text, product positions), so staff always read racks 1..N in the order they actually
 * walk a mirrored store.
 */
export function mirrorRackLabel(rack: string, allRacksAscending: string[], mirrored: boolean): string {
  if (!mirrored) return rack;
  const idx = allRacksAscending.indexOf(rack);
  if (idx === -1) return rack;
  return allRacksAscending[allRacksAscending.length - 1 - idx];
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

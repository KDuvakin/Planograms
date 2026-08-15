import type { EngineState } from "./types";

/**
 * A rack is "done" if every product touching it (on its old OR new side) no
 * longer needs action — true even before the first Step click, since it's
 * derived purely from the classification in buildInitial().
 */
export function isRackDone(state: EngineState, rackNum: string): boolean {
  return state.products.every((p) => {
    const involvesRack = p.rackOld === rackNum || p.rackNew === rackNum;
    if (!involvesRack) return true;
    if (p.isDeleted) return p.state === "deleted";
    return p.state === "correct";
  });
}

export function rackNumbers(state: EngineState): string[] {
  return Object.keys(state.racks).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
}

export function shelfNumbers(state: EngineState, rack: string): string[] {
  return Object.keys(state.racks[rack] ?? {}).sort((a, b) => parseInt(b, 10) - parseInt(a, 10)); // 7 -> 1, top to bottom
}

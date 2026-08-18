/**
 * Core data shapes for the planogram reset engine.
 * Ported 1:1 from the prototype's algorithm (planogram.js) — field names are
 * camelCased to match the Prisma schema instead of the prototype's
 * `"Rack old"`-style Excel-row keys, but the algorithm and constants are
 * unchanged.
 */

export type ProductState = "correct" | "move" | "deleted" | "new" | "temp";

export interface Product {
  /** Stable unique index for this run — assigned when loading items, used for all "same product" comparisons. */
  index: number;
  id: string;
  sap: string;
  ean: string | null;
  article: string;

  rackOld: string;
  shelfOld: string;
  positionNumberOld: string;
  facesOld: number;

  rackNew: string;
  shelfNew: string;
  positionNumberNew: string;
  facesNew: number;

  faceWidth: number;
  isNew: boolean;
  isDeleted: boolean;

  /** Mutable engine state, reset by buildInitial()/resetAll(). */
  currentFaces: number;
  state: ProductState;
  /** Settled target index once placed on its final shelf — undefined while still unplaced. */
  _ti?: number;
}

export interface GapMarker {
  __gap: true;
  width: number;
  /**
   * Indexes of the product(s) this gap was vacated by (evict/move-away/place-elsewhere) —
   * lets the UI highlight "this is the empty spot you're working on". An array because
   * coalesceGaps() merges neighbouring gaps together — a plain single field would lose
   * one side's identity whenever two vacated spots end up adjacent. Undefined/empty for
   * leftover-space gaps that never held a specific product.
   */
  fromProductIndexes?: number[];
}

export type ShelfSlot = Product | GapMarker;

export function isGap(slot: ShelfSlot): slot is GapMarker {
  return (slot as GapMarker).__gap === true;
}

export interface ShelfState {
  items: ShelfSlot[];
  cursor: number;
}

/** racks[rack][shelf] */
export type Racks = Record<string, Record<string, ShelfState>>;

export interface Basket {
  deleted: Product[];
  new: Product[];
  temp: Product[];
}

interface StepBase {
  product: Product;
  rack: string;
  shelf: string;
  ti?: number;
}

export interface EvictStep extends StepBase {
  type: "evict";
  to: "deleted" | "temp";
}
export interface MoveStep extends StepBase {
  type: "move";
  fromRack: string;
  fromShelf: string;
}
export interface ResizeStep extends StepBase {
  type: "resize";
  faces: number;
}
export interface PlaceStep extends StepBase {
  type: "place";
  source: "shelf" | "tempBasket" | "newBasket";
}
export interface ConfirmStep extends StepBase {
  type: "confirm";
}

export type Step = EvictStep | MoveStep | ResizeStep | PlaceStep | ConfirmStep;

export type NavigatorKind =
  | "idle"
  | "done"
  | "delete"
  | "pick"
  | "move"
  | "confirm"
  | "resize"
  | "place";

/**
 * The engine describes what happened as a message KEY + interpolation params
 * rather than a formatted sentence — actual wording (in whichever language the
 * user has picked) is rendered at the UI layer via next-intl, using `key`
 * against the "instructions" message namespace and `params` for
 * interpolation (article/sap/rack/shelf/etc).
 */
export interface NavigatorText {
  kind: NavigatorKind;
  key: string;
  params?: Record<string, string | number>;
}

export interface EngineState {
  products: Product[];
  racks: Racks;
  basket: Basket;
  steps: Step[];
  /** clickBoundaries[k] = raw index in `steps` right after the k-th real (clickable) step. */
  clickBoundaries: number[];
  realStepsTotal: number;
  /** Raw index into `steps`, including silently-absorbed "confirm" steps. */
  currentStep: number;
  /** Count of real actions performed so far. */
  currentRealStep: number;
  navigator: NavigatorText;
}

export const EPS = 0.001;
/** cm — if short by less than this, treat it as "fits", don't evict a neighbour for a couple of millimetres. */
export const FIT_SLACK = 1;
export const EPS_GAP = 0.01;
/** cm — must match FIT_SLACK: what buildSteps() considered "close enough to fit" must also render as fitting. */
export const RENDER_FIT_SLACK = 1;

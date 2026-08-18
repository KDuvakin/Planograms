"use client";

import styles from "./run.module.css";

/** Sits directly above whichever block/gap it's rendered inside — tied to that
 * element's actual position by DOM structure, not a separately computed pixel offset. */
export function PositionArrow() {
  return (
    <svg
      className={styles.positionArrow}
      width="22"
      height="25"
      viewBox="0 0 28 30"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M10 0H18V15H26L14 29L2 15H10V0Z" />
    </svg>
  );
}

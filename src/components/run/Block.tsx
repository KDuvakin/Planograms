"use client";

import { isGap, type Product, type ShelfSlot } from "@/lib/engine";
import styles from "./run.module.css";

const STATE_CLASS: Record<Product["state"], string> = {
  correct: styles.ok,
  move: styles.move,
  deleted: styles.danger,
  new: styles.new,
  temp: styles.move,
};

export function Block({
  slot,
  scale,
  highlighted,
}: {
  slot: ShelfSlot;
  scale: number;
  highlighted?: boolean;
}) {
  if (isGap(slot)) {
    return <div className={styles.gap} style={{ width: Math.max(slot.width * scale, 2) }} />;
  }

  const widthPx = Math.max(slot.faceWidth * slot.currentFaces * scale, 30);

  return (
    <div
      className={`${styles.block} ${STATE_CLASS[slot.state]} ${highlighted ? styles.highlighted : ""}`}
      style={{ width: widthPx }}
      title={`${slot.article} · SAP ${slot.sap}`}
    >
      <div className={styles.blockSap}>{slot.sap}</div>
      <div className={styles.blockName}>{slot.article}</div>
    </div>
  );
}

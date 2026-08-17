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
  highlightIndex,
}: {
  slot: ShelfSlot;
  scale: number;
  highlightIndex?: number;
}) {
  if (isGap(slot)) {
    // The gap a just-picked/moved-away item left behind — outline it so it's clear
    // where that item used to be, instead of it just silently vanishing.
    const isVacatedSpot = highlightIndex !== undefined && slot.fromProductIndex === highlightIndex;
    return (
      <div
        className={`${styles.gap} ${isVacatedSpot ? styles.gapHighlighted : ""}`}
        style={{ width: Math.max(slot.width * scale, 2) }}
      />
    );
  }

  const widthPx = Math.max(slot.faceWidth * slot.currentFaces * scale, 30);
  const isHighlighted = slot.index === highlightIndex;

  return (
    <div
      className={`${styles.block} ${STATE_CLASS[slot.state]} ${isHighlighted ? styles.highlighted : ""}`}
      style={{ width: widthPx }}
      title={`${slot.article} · SAP ${slot.sap}`}
    >
      <div className={styles.blockSap}>{slot.sap}</div>
      <div className={styles.blockName}>{slot.article}</div>
    </div>
  );
}

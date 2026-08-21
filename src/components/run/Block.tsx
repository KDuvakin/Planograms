"use client";

import { isGap, type Product, type ShelfSlot } from "@/lib/engine";
import { PositionArrow } from "./PositionArrow";
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
  onSelect,
}: {
  slot: ShelfSlot;
  scale: number;
  highlightIndex?: number;
  onSelect?: (slot: ShelfSlot) => void;
}) {
  if (isGap(slot)) {
    // The gap a just-picked/moved-away item left behind — outline it so it's clear
    // where that item used to be, instead of it just silently vanishing.
    const isVacatedSpot = highlightIndex !== undefined && (slot.fromProductIndexes?.includes(highlightIndex) ?? false);
    return (
      <div className={styles.slotWrap} style={{ width: Math.max(slot.width * scale, 2) }}>
        {isVacatedSpot && <PositionArrow direction="up" />}
        <div
          className={`${styles.gap} ${isVacatedSpot ? styles.gapHighlighted : ""}`}
          data-shelf-highlight={isVacatedSpot || undefined}
        />
      </div>
    );
  }

  const widthPx = Math.max(slot.faceWidth * slot.currentFaces * scale, 30);
  const isHighlighted = slot.index === highlightIndex;

  return (
    <div className={styles.slotWrap} style={{ width: widthPx }}>
      {isHighlighted && <PositionArrow />}
      <div
        className={`${styles.block} ${STATE_CLASS[slot.state]} ${isHighlighted ? styles.highlighted : ""}`}
        title={`${slot.article} · SAP ${slot.sap}`}
        data-shelf-highlight={isHighlighted || undefined}
        onClick={onSelect ? () => onSelect(slot) : undefined}
        role={onSelect ? "button" : undefined}
        tabIndex={onSelect ? 0 : undefined}
      >
        <div className={styles.blockSap}>{slot.sap}</div>
        <div className={styles.blockName}>{slot.article}</div>
      </div>
    </div>
  );
}

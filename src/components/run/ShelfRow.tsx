"use client";

import { useTranslations } from "next-intl";
import { isGap, type ShelfSlot } from "@/lib/engine";
import { Block } from "./Block";
import styles from "./run.module.css";

export function ShelfRow({
  shelfNum,
  items,
  scale,
  highlightIndex,
}: {
  shelfNum: string;
  items: ShelfSlot[];
  scale: number;
  highlightIndex?: number;
}) {
  const t = useTranslations("run");
  return (
    <div className={styles.shelfRow}>
      <div className={styles.shelfLabel}>{t("shelfLabel", { n: shelfNum })}</div>
      <div className={styles.shelf}>
        {items.map((slot, i) => (
          <Block
            key={isGap(slot) ? `gap-${i}` : slot.index}
            slot={slot}
            scale={scale}
            highlighted={!isGap(slot) && slot.index === highlightIndex}
          />
        ))}
      </div>
    </div>
  );
}

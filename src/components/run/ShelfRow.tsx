"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { isGap, type ShelfSlot } from "@/lib/engine";
import { Block } from "./Block";
import styles from "./run.module.css";

export function ShelfRow({
  shelfNum,
  items,
  scale,
  highlightIndex,
  highlightColor,
  mirrored,
  onSelectProduct,
}: {
  shelfNum: string;
  items: ShelfSlot[];
  scale: number;
  highlightIndex?: number;
  /** CSS color (e.g. "var(--danger)") the position arrow(s)/outline should use for this
   * shelf's current step — reflects what kind of action it is (remove/new/relocate). */
  highlightColor?: string;
  /** Planogram.mirrored — reverses left-right render order only; data/instructions never change. */
  mirrored?: boolean;
  onSelectProduct?: (slot: ShelfSlot) => void;
}) {
  const t = useTranslations("run");
  const productsRef = useRef<HTMLDivElement>(null);
  const renderItems = mirrored ? [...items].reverse() : items;

  // Keep the position we're working on scrolled into view. The arrow that points at it
  // lives on the block/gap itself (see Block.tsx), so it can never point at the wrong spot.
  useEffect(() => {
    if (highlightIndex === undefined) return;
    const target = productsRef.current?.querySelector<HTMLElement>("[data-shelf-highlight]");
    target?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [highlightIndex]);

  return (
    <div className={styles.shelfRow} style={highlightColor ? ({ "--highlight-color": highlightColor } as React.CSSProperties) : undefined}>
      <div
        className={`${styles.shelfProducts} ${highlightIndex !== undefined ? styles.shelfProductsWithArrow : ""}`}
        ref={productsRef}
      >
        {renderItems.map((slot, i) => (
          <Block
            key={isGap(slot) ? `gap-${i}` : slot.index}
            slot={slot}
            scale={scale}
            highlightIndex={highlightIndex}
            onSelect={onSelectProduct}
          />
        ))}
      </div>
      <div className={styles.shelfLedge}>
        <span className={styles.shelfNumberTag}>{t("shelfLabel", { n: shelfNum })}</span>
        <span className={styles.shelfDirection}>
          {/* Always drawn left-to-right: once the whole planogram (rack order + shelf
              order) is mirrored, reading the screen left-to-right already matches how
              customers walk — the arrow never needs to flip on its own. */}
          <span className={styles.shelfDirectionArrow} aria-hidden="true">
            →
          </span>
          {t("customerFlowLabel")}
        </span>
      </div>
    </div>
  );
}

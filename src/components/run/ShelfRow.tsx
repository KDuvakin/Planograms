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
  onHighlightRectChange,
}: {
  shelfNum: string;
  items: ShelfSlot[];
  scale: number;
  highlightIndex?: number;
  onHighlightRectChange?: (rect: DOMRect | null) => void;
}) {
  const t = useTranslations("run");
  const productsRef = useRef<HTMLDivElement>(null);

  // Keep the position we're working on scrolled into view, and keep reporting its
  // on-screen rect so a caller (the down-arrow above the panel) can track it precisely
  // instead of just assuming it lands in the horizontal center.
  useEffect(() => {
    const container = productsRef.current;
    if (highlightIndex === undefined || !container) {
      onHighlightRectChange?.(null);
      return;
    }
    const target = container.querySelector<HTMLElement>("[data-shelf-highlight]");
    if (!target) {
      onHighlightRectChange?.(null);
      return;
    }
    target.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });

    const report = () => onHighlightRectChange?.(target.getBoundingClientRect());
    report();
    container.addEventListener("scroll", report, { passive: true });
    // The smooth scroll above settles asynchronously — keep sampling briefly so the
    // arrow follows it all the way in, then take one final reading once it's done.
    const settleTimer = window.setTimeout(report, 450);
    return () => {
      container.removeEventListener("scroll", report);
      window.clearTimeout(settleTimer);
    };
  }, [highlightIndex, onHighlightRectChange]);

  return (
    <div className={styles.shelfRow}>
      <div className={styles.shelfProducts} ref={productsRef}>
        {items.map((slot, i) => (
          <Block key={isGap(slot) ? `gap-${i}` : slot.index} slot={slot} scale={scale} highlightIndex={highlightIndex} />
        ))}
      </div>
      <div className={styles.shelfLedge}>
        <span className={styles.shelfNumberTag}>{t("shelfLabel", { n: shelfNum })}</span>
      </div>
    </div>
  );
}

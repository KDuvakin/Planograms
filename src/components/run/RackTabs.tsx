"use client";

import { useTranslations } from "next-intl";
import styles from "./run.module.css";

export function RackTabs({
  racks,
  current,
  onSelect,
}: {
  racks: string[];
  current: string;
  onSelect: (rack: string) => void;
}) {
  const t = useTranslations("run");
  const idx = racks.indexOf(current);

  return (
    <div className={styles.rackTabsWrap}>
      <div className={styles.rackTabsLabel}>
        {t("rackLabel")} {current}
      </div>
      <div className={styles.rackTabs}>
        <button
          type="button"
          className={styles.rackArrow}
          disabled={idx <= 0}
          onClick={() => idx > 0 && onSelect(racks[idx - 1])}
          aria-label={t("prevRackAria")}
        >
          ‹
        </button>

        <div className={styles.tabsScroll}>
          {racks.map((r) => (
            <button
              key={r}
              type="button"
              className={r === current ? styles.tabActive : styles.tab}
              onClick={() => onSelect(r)}
            >
              {r}
            </button>
          ))}
        </div>

        <button
          type="button"
          className={styles.rackArrow}
          disabled={idx === -1 || idx >= racks.length - 1}
          onClick={() => idx < racks.length - 1 && onSelect(racks[idx + 1])}
          aria-label={t("nextRackAria")}
        >
          ›
        </button>
      </div>
    </div>
  );
}

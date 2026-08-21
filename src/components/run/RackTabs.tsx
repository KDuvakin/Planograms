"use client";

import { useTranslations } from "next-intl";
import styles from "./run.module.css";

export function RackTabs({
  racks,
  current,
  onSelect,
  changedRacks,
}: {
  racks: string[];
  current: string;
  onSelect: (rack: string) => void;
  /** Racks with any pending change — colors the tab so staff can spot which racks need work. */
  changedRacks?: Set<string>;
}) {
  const t = useTranslations("run");
  const tLegend = useTranslations("preview.legend");
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
          {racks.map((r) => {
            const hasChanges = changedRacks?.has(r) ?? false;
            return (
              <button
                key={r}
                type="button"
                className={r === current ? styles.tabActive : styles.tab}
                onClick={() => onSelect(r)}
                title={changedRacks ? tLegend(hasChanges ? "changed" : "ok") : undefined}
              >
                {r}
                {changedRacks && (
                  <span className={`${styles.tabDot} ${hasChanges ? styles.tabDotChanged : styles.tabDotOk}`} />
                )}
              </button>
            );
          })}
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

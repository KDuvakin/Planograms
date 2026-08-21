"use client";

import { useTranslations } from "next-intl";
import { mirrorRackLabel } from "@/lib/engine";
import styles from "./run.module.css";

export function RackTabs({
  racks,
  current,
  onSelect,
  changedRacks,
  allRacks,
  mirrored,
}: {
  racks: string[];
  current: string;
  onSelect: (rack: string) => void;
  /** Racks with any pending change — colors the tab so staff can spot which racks need work. */
  changedRacks?: Set<string>;
  /** Full true rack list (unreversed) — needed to compute the mirrored label. */
  allRacks: string[];
  mirrored: boolean;
}) {
  const t = useTranslations("run");
  const tLegend = useTranslations("preview.legend");
  const idx = racks.indexOf(current);
  const labelFor = (r: string) => mirrorRackLabel(r, allRacks, mirrored);

  return (
    <div className={styles.rackTabsWrap}>
      <div className={styles.rackTabsLabel}>
        {t("rackLabel")} {labelFor(current)}
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
                {labelFor(r)}
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

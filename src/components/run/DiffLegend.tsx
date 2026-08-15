"use client";

import { useTranslations } from "next-intl";
import styles from "./run.module.css";

export function DiffLegend() {
  const t = useTranslations("preview.legend");

  return (
    <ul className={styles.legend}>
      <li>
        <span className={`${styles.legendDot} ${styles.ok}`} /> {t("ok")}
      </li>
      <li>
        <span className={`${styles.legendDot} ${styles.move}`} /> {t("changed")}
      </li>
      <li>
        <span className={`${styles.legendDot} ${styles.new}`} /> {t("new")}
      </li>
      <li>
        <span className={`${styles.legendDot} ${styles.danger}`} /> {t("removed")}
      </li>
    </ul>
  );
}

"use client";

import { useTranslations } from "next-intl";
import styles from "./run.module.css";

export function DiffLegend() {
  const t = useTranslations("preview.legend");

  return (
    <ul className={styles.legend}>
      <li className={`${styles.legendPill} ${styles.ok}`}>{t("ok")}</li>
      <li className={`${styles.legendPill} ${styles.move}`}>{t("changed")}</li>
      <li className={`${styles.legendPill} ${styles.new}`}>{t("new")}</li>
      <li className={`${styles.legendPill} ${styles.danger}`}>{t("removed")}</li>
    </ul>
  );
}

"use client";

import { useTranslations } from "next-intl";
import styles from "./completion.module.css";

export function CompletionScreen({
  placedCount,
  removedCount,
  feedbackCount,
  totalSteps,
  userName,
  onDone,
}: {
  placedCount: number;
  removedCount: number;
  feedbackCount: number;
  totalSteps: number;
  userName: string;
  onDone: () => void;
}) {
  const t = useTranslations("completion");

  return (
    <div className={styles.wrap}>
      <div className={styles.badge}>✓</div>
      <h1 className={styles.title}>{t("title")}</h1>

      <ul className={styles.stats}>
        <li>
          <span className={styles.statIcon}>✓</span>
          {t("placed", { count: placedCount })}
        </li>
        <li>
          <span className={styles.statIcon}>💬</span>
          {t("feedbackSent", { count: feedbackCount })}
        </li>
        <li>
          <span className={styles.statIcon}>⚠</span>
          {t("removed", { count: removedCount })}
        </li>
        <li>
          <span className={styles.statIcon}>✓</span>
          {t("stepsCompleted", { count: totalSteps, total: totalSteps })}
        </li>
      </ul>

      <p className={styles.thanks}>{t("thanks", { name: userName })}</p>

      <button type="button" className={styles.doneBtn} onClick={onDone}>
        {t("done")}
      </button>
    </div>
  );
}

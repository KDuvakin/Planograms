"use client";

import { useLocale, useTranslations } from "next-intl";
import styles from "./admin.module.css";
import modalStyles from "./FeedbackHistoryModal.module.css";

const REASON_KEYS = ["needSeparator", "doesntFitByHeight", "doesntFitFacesQty", "otherReason"] as const;

export interface FeedbackHistoryItem {
  id: string;
  comment: string;
  photos: { url: string }[];
  createdAt: string;
  needSeparator: boolean;
  doesntFitByHeight: boolean;
  doesntFitFacesQty: boolean;
  otherReason: boolean;
  user: { email: string; name: string | null };
  planogramItem: { sap: string; article: string } | null;
}

export function FeedbackHistoryModal({
  title,
  items,
  onClose,
}: {
  title: string;
  items: FeedbackHistoryItem[];
  onClose: () => void;
}) {
  const t = useTranslations("analytics");
  const tCommon = useTranslations("common");
  const locale = useLocale();

  return (
    <div className={modalStyles.overlay} onClick={onClose}>
      <div className={modalStyles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={modalStyles.header}>
          <h2 className={modalStyles.title}>{title}</h2>
          <button type="button" className={modalStyles.closeBtn} onClick={onClose}>
            {tCommon("close")}
          </button>
        </div>

        <div className={styles.recordList}>
          {items.map((f) => {
            const reasons = REASON_KEYS.filter((key) => f[key]);
            return (
              <div key={f.id} className={styles.recordCard}>
                <div className={styles.recordHeader}>
                  <span>{new Date(f.createdAt).toLocaleString(locale)}</span>
                </div>
                {f.photos.length > 0 && (
                  <div className={styles.thumbRow}>
                    {f.photos.map((p, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={p.url} alt="" className={styles.thumb} />
                    ))}
                  </div>
                )}
                <div className={styles.recordRow}>
                  <span>{t("feedbackTable.product")}</span>
                  <span>{f.planogramItem ? `${f.planogramItem.article} (${f.planogramItem.sap})` : "—"}</span>
                </div>
                {reasons.length > 0 && (
                  <div className={styles.recordRow}>
                    <span>{t("feedbackTable.reasons")}</span>
                    <span>{reasons.map((r) => t(`reason.${r}`)).join(", ")}</span>
                  </div>
                )}
                {f.comment && <p className={styles.recordComment}>«{f.comment}»</p>}
                <div className={styles.recordRow}>
                  <span>{t("feedbackTable.user")}</span>
                  <span>{f.user.name ?? f.user.email}</span>
                </div>
              </div>
            );
          })}
          {items.length === 0 && <p className={styles.hintText}>{t("noFeedback")}</p>}
        </div>
      </div>
    </div>
  );
}

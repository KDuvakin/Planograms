"use client";

import { useState } from "react";
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
  reply: string | null;
  accepted: boolean;
  repliedBy: { email: string; name: string | null } | null;
  flaggedBySpecialist: boolean;
}

function ReplyForm({ item, onUpdated }: { item: FeedbackHistoryItem; onUpdated: () => void }) {
  const t = useTranslations("analytics");
  const [reply, setReply] = useState(item.reply ?? "");
  const [accepted, setAccepted] = useState(item.accepted);
  const [saving, setSaving] = useState(false);
  const [flagging, setFlagging] = useState(false);

  async function handleSave() {
    setSaving(true);
    await fetch(`/api/feedback/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reply, accepted }),
    });
    setSaving(false);
    onUpdated();
  }

  // Independent of the reply itself — lets a specialist say "I need the store to check
  // or clarify something" before they're ready to write an actual answer. Saving a real
  // reply (or ticking "accepted") clears it automatically on the server.
  async function toggleFlag() {
    setFlagging(true);
    await fetch(`/api/feedback/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flaggedBySpecialist: !item.flaggedBySpecialist }),
    });
    setFlagging(false);
    onUpdated();
  }

  const dirty = reply !== (item.reply ?? "") || accepted !== item.accepted;

  return (
    <div className={styles.replyBox}>
      <textarea
        className={styles.textarea}
        placeholder={t("replyPlaceholder")}
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        rows={2}
      />
      <div className={styles.replyActions}>
        <label className={styles.checkboxRow}>
          <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
          {t("acceptedLabel")}
        </label>
        <button type="button" className={styles.btnGhost} disabled={!dirty || saving} onClick={handleSave}>
          {saving ? t("saving") : t("saveReply")}
        </button>
        <button type="button" className={styles.btnGhost} disabled={flagging} onClick={toggleFlag}>
          {item.flaggedBySpecialist ? t("unflagSpecialist") : t("flagSpecialist")}
        </button>
      </div>
    </div>
  );
}

export function FeedbackHistoryModal({
  title,
  items,
  onClose,
  canReply = false,
  onUpdated,
}: {
  title: string;
  items: FeedbackHistoryItem[];
  onClose: () => void;
  canReply?: boolean;
  onUpdated?: () => void;
}) {
  const t = useTranslations("analytics");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const [openPhoto, setOpenPhoto] = useState<string | null>(null);

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
              <div
                key={f.id}
                className={`${styles.recordCard} ${f.flaggedBySpecialist ? styles.recordCardNeedsReply : ""}`}
              >
                <div className={styles.recordHeader}>
                  <span>{new Date(f.createdAt).toLocaleString(locale)}</span>
                </div>
                {f.photos.length > 0 && (
                  <div className={styles.thumbRow}>
                    {f.photos.map((p, i) => (
                      <button
                        key={i}
                        type="button"
                        className={styles.thumbBtn}
                        onClick={() => setOpenPhoto(p.url)}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.url} alt="" className={styles.thumb} />
                      </button>
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

                {(f.reply || f.accepted) && (
                  <div className={styles.replyReadout}>
                    {f.reply && <p className={styles.recordComment}>«{f.reply}»</p>}
                    <div className={styles.recordRow}>
                      <span>{t("repliedByLabel")}</span>
                      <span>
                        {f.repliedBy?.name ?? f.repliedBy?.email}
                        {f.accepted ? ` · ${t("acceptedLabel")}` : ""}
                      </span>
                    </div>
                  </div>
                )}

                {canReply && onUpdated && <ReplyForm item={f} onUpdated={onUpdated} />}
              </div>
            );
          })}
          {items.length === 0 && <p className={styles.hintText}>{t("noFeedback")}</p>}
        </div>
      </div>

      {openPhoto && (
        <div
          className={styles.photoLightboxOverlay}
          onClick={(e) => {
            e.stopPropagation();
            setOpenPhoto(null);
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={openPhoto} alt="" className={styles.photoLightboxImg} />
        </div>
      )}
    </div>
  );
}

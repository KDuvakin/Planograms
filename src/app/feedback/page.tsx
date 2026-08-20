"use client";

import { useState } from "react";
import useSWR from "swr";
import { useLocale, useTranslations } from "next-intl";
import { PageHeader } from "@/components/PageHeader";
import { TopNav } from "@/components/TopNav";
import styles from "@/components/admin/admin.module.css";
import { fetcher } from "@/lib/swrFetcher";

const REASON_KEYS = ["needSeparator", "doesntFitByHeight", "doesntFitFacesQty", "otherReason"] as const;

interface FeedbackRow {
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
  flaggedByStore: boolean;
  run: { planogram: { node: string } };
}

export default function StoreFeedbackPage() {
  const t = useTranslations("storeFeedback");
  const tAnalytics = useTranslations("analytics");
  const locale = useLocale();
  const { data: feedback, mutate } = useSWR<FeedbackRow[]>("/api/feedback", fetcher);
  const [openPhoto, setOpenPhoto] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function toggleFlag(f: FeedbackRow) {
    setPendingId(f.id);
    await fetch(`/api/feedback/${f.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flaggedByStore: !f.flaggedByStore }),
    });
    setPendingId(null);
    mutate();
  }

  return (
    <main className={styles.page}>
      <PageHeader title={t("title")} />

      <TopNav />

      <div className={styles.card}>
        <div className={styles.recordList}>
          {feedback?.map((f) => {
            const reasons = REASON_KEYS.filter((key) => f[key]);
            return (
              <div
                key={f.id}
                className={`${styles.recordCard} ${f.flaggedByStore ? styles.recordCardFlagged : ""}`}
              >
                <div className={styles.recordHeader}>
                  <span>{f.run.planogram.node}</span>
                  <span>{new Date(f.createdAt).toLocaleString(locale)}</span>
                </div>
                {f.photos.length > 0 && (
                  <div className={styles.thumbRow}>
                    {f.photos.map((p, i) => (
                      <button key={i} type="button" className={styles.thumbBtn} onClick={() => setOpenPhoto(p.url)}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.url} alt="" className={styles.thumb} />
                      </button>
                    ))}
                  </div>
                )}
                <div className={styles.recordRow}>
                  <span>{tAnalytics("feedbackTable.product")}</span>
                  <span>{f.planogramItem ? `${f.planogramItem.article} (${f.planogramItem.sap})` : "—"}</span>
                </div>
                {reasons.length > 0 && (
                  <div className={styles.recordRow}>
                    <span>{tAnalytics("feedbackTable.reasons")}</span>
                    <span>{reasons.map((r) => tAnalytics(`reason.${r}`)).join(", ")}</span>
                  </div>
                )}
                {f.comment && <p className={styles.recordComment}>«{f.comment}»</p>}
                <div className={styles.recordRow}>
                  <span>{tAnalytics("feedbackTable.user")}</span>
                  <span>{f.user.name ?? f.user.email}</span>
                </div>

                {(f.reply || f.accepted) && (
                  <div className={styles.replyReadout}>
                    {f.reply && <p className={styles.recordComment}>«{f.reply}»</p>}
                    <div className={styles.recordRow}>
                      <span>{tAnalytics("repliedByLabel")}</span>
                      <span>
                        {f.repliedBy?.name ?? f.repliedBy?.email}
                        {f.accepted ? ` · ${tAnalytics("acceptedLabel")}` : ""}
                      </span>
                    </div>
                  </div>
                )}

                <div className={styles.replyActions}>
                  <button
                    type="button"
                    className={styles.btnGhost}
                    disabled={pendingId === f.id}
                    onClick={() => toggleFlag(f)}
                  >
                    {f.flaggedByStore ? t("unflag") : t("flag")}
                  </button>
                </div>
              </div>
            );
          })}
          {feedback?.length === 0 && <p className={styles.hintText}>{t("empty")}</p>}
        </div>
      </div>

      {openPhoto && (
        <div
          className={styles.photoLightboxOverlay}
          onClick={() => setOpenPhoto(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={openPhoto} alt="" className={styles.photoLightboxImg} />
        </div>
      )}
    </main>
  );
}

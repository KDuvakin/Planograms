"use client";

import { useState } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { TopNav } from "@/components/TopNav";
import styles from "@/components/admin/admin.module.css";
import { fetcher } from "@/lib/swrFetcher";

interface Summary {
  totals: {
    notStarted: number;
    inProgress: number;
    done: number;
    notDonePlanograms: number;
    totalPlanograms: number;
  };
  avgDurationMinutes: number | null;
  byStore: { storeCode: string; done: number; inProgress: number }[];
  recentCompletions: { storeCode: string; userLabel: string; finishedAt: string; durationMinutes: number }[];
}

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
  run: { planogram: { node: string; store: { code: string } } };
}

interface Store {
  id: string;
  code: string;
}

interface RunRow {
  id: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "DONE" | "ABANDONED";
  currentRealStep: number;
  realStepsTotal: number;
  startedAt: string | null;
  finishedAt: string | null;
  user: { email: string; name: string | null };
  planogram: { node: string; store: { code: string } };
}

const REASON_KEYS = ["needSeparator", "doesntFitByHeight", "doesntFitFacesQty", "otherReason"] as const;

export default function AnalyticsPage() {
  const t = useTranslations("analytics");
  const locale = useLocale();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  const { data: summary } = useSWR<Summary>("/api/analytics/summary", fetcher);
  const { data: feedback } = useSWR<FeedbackRow[]>("/api/feedback", fetcher);
  const { data: stores } = useSWR<Store[]>(isAdmin ? "/api/stores" : null, fetcher);

  const [storeId, setStoreId] = useState("");
  const runsUrl = storeId ? `/api/analytics/runs?storeId=${storeId}` : "/api/analytics/runs";
  const { data: runs } = useSWR<RunRow[]>(runsUrl, fetcher);

  return (
    <main className={styles.page}>
      <TopNav />

      <h1 className={styles.title}>{t("title")}</h1>

      {summary && (
        <>
          <div className={styles.statCards}>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{summary.totals.totalPlanograms}</div>
              <div className={styles.statLabel}>{t("stats.total")}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{summary.totals.done}</div>
              <div className={styles.statLabel}>{t("stats.done")}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{summary.totals.inProgress}</div>
              <div className={styles.statLabel}>{t("stats.inProgress")}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{summary.totals.notStarted}</div>
              <div className={styles.statLabel}>{t("stats.notStarted")}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{summary.totals.notDonePlanograms}</div>
              <div className={styles.statLabel}>{t("stats.notDone")}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>
                {summary.avgDurationMinutes != null
                  ? `${summary.avgDurationMinutes} ${t("minutesShort")}`
                  : "—"}
              </div>
              <div className={styles.statLabel}>{t("stats.avgDuration")}</div>
            </div>
          </div>

          {isAdmin && (
            <div className={styles.card}>
              <h2 className={styles.subtitle}>{t("byStoreTitle")}</h2>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>{t("byStoreTable.store")}</th>
                      <th>{t("byStoreTable.done")}</th>
                      <th>{t("byStoreTable.inProgress")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.byStore.map((s) => (
                      <tr key={s.storeCode}>
                        <td>{s.storeCode}</td>
                        <td>{s.done}</td>
                        <td>{s.inProgress}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <div className={styles.card}>
        <h2 className={styles.subtitle}>{t("runsTitle")}</h2>
        {isAdmin && (
          <select className={styles.select} value={storeId} onChange={(e) => setStoreId(e.target.value)}>
            <option value="">{t("allStores")}</option>
            {stores?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code}
              </option>
            ))}
          </select>
        )}

        <div className={styles.recordList}>
          {runs?.map((r) => {
            const durationMinutes =
              r.startedAt && r.finishedAt
                ? Math.round(((new Date(r.finishedAt).getTime() - new Date(r.startedAt).getTime()) / 60000) * 10) /
                  10
                : null;
            return (
              <div key={r.id} className={styles.recordCard}>
                <div className={styles.recordHeader}>
                  <span className={styles.recordTitle}>
                    {r.planogram.store.code} · {r.planogram.node}
                  </span>
                  <span className={`${styles.statusPill} ${styles[`pill_${r.status}`]}`}>
                    {t(`status.${r.status}`)}
                  </span>
                </div>
                <div className={styles.recordRow}>
                  <span>{t("runsTable.user")}</span>
                  <span>{r.user.name ?? r.user.email}</span>
                </div>
                <div className={styles.recordRow}>
                  <span>{t("runsTable.step")}</span>
                  <span>
                    {r.currentRealStep}/{r.realStepsTotal}
                  </span>
                </div>
                <div className={styles.recordRow}>
                  <span>{t("runsTable.started")}</span>
                  <span>{r.startedAt ? new Date(r.startedAt).toLocaleString(locale) : "—"}</span>
                </div>
                <div className={styles.recordRow}>
                  <span>{t("runsTable.finished")}</span>
                  <span>{r.finishedAt ? new Date(r.finishedAt).toLocaleString(locale) : "—"}</span>
                </div>
                {durationMinutes != null && (
                  <div className={styles.recordRow}>
                    <span>{t("runsTable.duration")}</span>
                    <span>{durationMinutes}</span>
                  </div>
                )}
              </div>
            );
          })}
          {runs?.length === 0 && <p className={styles.hintText}>{t("noRuns")}</p>}
        </div>
      </div>

      <div className={styles.card}>
        <h2 className={styles.subtitle}>{t("feedbackTitle")}</h2>
        <div className={styles.recordList}>
          {feedback?.map((f) => {
            const reasons = REASON_KEYS.filter((key) => f[key]);
            return (
              <div key={f.id} className={styles.recordCard}>
                <div className={styles.recordHeader}>
                  <span className={styles.recordTitle}>
                    {f.run.planogram.store.code} / {f.run.planogram.node}
                  </span>
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
          {feedback?.length === 0 && <p className={styles.hintText}>{t("noFeedback")}</p>}
        </div>
      </div>
    </main>
  );
}

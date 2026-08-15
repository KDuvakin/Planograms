"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { useLocale, useTranslations } from "next-intl";
import styles from "@/components/admin/admin.module.css";

interface Summary {
  totals: { notStarted: number; inProgress: number; done: number; abandoned: number };
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

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const REASON_KEYS = ["needSeparator", "doesntFitByHeight", "doesntFitFacesQty", "otherReason"] as const;

export default function AnalyticsPage() {
  const t = useTranslations("analytics");
  const tNav = useTranslations("nav");
  const locale = useLocale();
  const { data: summary } = useSWR<Summary>("/api/analytics/summary", fetcher);
  const { data: feedback } = useSWR<FeedbackRow[]>("/api/feedback", fetcher);
  const { data: stores } = useSWR<Store[]>("/api/stores", fetcher);

  const [storeId, setStoreId] = useState("");
  const runsUrl = storeId ? `/api/analytics/runs?storeId=${storeId}` : "/api/analytics/runs";
  const { data: runs } = useSWR<RunRow[]>(runsUrl, fetcher);

  return (
    <main className={styles.page}>
      <nav className={styles.nav}>
        <Link href="/planograms">{tNav("planograms")}</Link>
        <Link href="/admin/import">{tNav("import")}</Link>
        <Link href="/admin/users">{tNav("users")}</Link>
        <Link href="/admin/stores">{tNav("stores")}</Link>
      </nav>

      <h1 className={styles.title}>{t("title")}</h1>

      {summary && (
        <>
          <div className={styles.statCards}>
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
              <div className={styles.statValue}>
                {summary.avgDurationMinutes != null
                  ? `${summary.avgDurationMinutes} ${t("minutesShort")}`
                  : "—"}
              </div>
              <div className={styles.statLabel}>{t("stats.avgDuration")}</div>
            </div>
          </div>

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
        </>
      )}

      <div className={styles.card}>
        <h2 className={styles.subtitle}>{t("runsTitle")}</h2>
        <select className={styles.select} value={storeId} onChange={(e) => setStoreId(e.target.value)}>
          <option value="">{t("allStores")}</option>
          {stores?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.code}
            </option>
          ))}
        </select>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t("runsTable.store")}</th>
                <th>{t("runsTable.planogram")}</th>
                <th>{t("runsTable.user")}</th>
                <th>{t("runsTable.status")}</th>
                <th>{t("runsTable.step")}</th>
                <th>{t("runsTable.started")}</th>
                <th>{t("runsTable.finished")}</th>
                <th>{t("runsTable.duration")}</th>
              </tr>
            </thead>
            <tbody>
              {runs?.map((r) => {
                const durationMinutes =
                  r.startedAt && r.finishedAt
                    ? Math.round(
                        ((new Date(r.finishedAt).getTime() - new Date(r.startedAt).getTime()) / 60000) * 10
                      ) / 10
                    : null;
                return (
                  <tr key={r.id}>
                    <td>{r.planogram.store.code}</td>
                    <td>{r.planogram.node}</td>
                    <td>{r.user.name ?? r.user.email}</td>
                    <td>{t(`status.${r.status}`)}</td>
                    <td>
                      {r.currentRealStep}/{r.realStepsTotal}
                    </td>
                    <td>{r.startedAt ? new Date(r.startedAt).toLocaleString(locale) : "—"}</td>
                    <td>{r.finishedAt ? new Date(r.finishedAt).toLocaleString(locale) : "—"}</td>
                    <td>{durationMinutes ?? "—"}</td>
                  </tr>
                );
              })}
              {runs?.length === 0 && (
                <tr>
                  <td colSpan={8}>{t("noRuns")}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className={styles.card}>
        <h2 className={styles.subtitle}>{t("feedbackTitle")}</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t("feedbackTable.photo")}</th>
                <th>{t("feedbackTable.storeAndPlanogram")}</th>
                <th>{t("feedbackTable.product")}</th>
                <th>{t("feedbackTable.reasons")}</th>
                <th>{t("feedbackTable.comment")}</th>
                <th>{t("feedbackTable.user")}</th>
                <th>{t("feedbackTable.when")}</th>
              </tr>
            </thead>
            <tbody>
              {feedback?.map((f) => {
                const reasons = REASON_KEYS.filter((key) => f[key]);
                return (
                  <tr key={f.id}>
                    <td>
                      {f.photos.length ? (
                        <div className={styles.thumbRow}>
                          {f.photos.map((p, i) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img key={i} src={p.url} alt="" className={styles.thumb} />
                          ))}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      {f.run.planogram.store.code} / {f.run.planogram.node}
                    </td>
                    <td>{f.planogramItem ? `${f.planogramItem.article} (${f.planogramItem.sap})` : "—"}</td>
                    <td>{reasons.length ? reasons.map((r) => t(`reason.${r}`)).join(", ") : "—"}</td>
                    <td>{f.comment || "—"}</td>
                    <td>{f.user.name ?? f.user.email}</td>
                    <td>{new Date(f.createdAt).toLocaleString(locale)}</td>
                  </tr>
                );
              })}
              {feedback?.length === 0 && (
                <tr>
                  <td colSpan={7}>{t("noFeedback")}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

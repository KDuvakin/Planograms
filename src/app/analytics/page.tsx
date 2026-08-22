"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { PageHeader } from "@/components/PageHeader";
import { TopNav } from "@/components/TopNav";
import { FeedbackHistoryModal, type FeedbackHistoryItem } from "@/components/admin/FeedbackHistoryModal";
import { resolveNodeCategory, type CategoryWithNodes } from "@/lib/nodeCategory";
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
  byStore: { storeCode: string; done: number; inProgress: number; notStarted: number; total: number }[];
  recentCompletions: { storeCode: string; userLabel: string; finishedAt: string; durationMinutes: number }[];
}

interface FeedbackRow extends FeedbackHistoryItem {
  run: { planogramId: string; planogram: { node: string; store: { code: string } } };
}

interface Store {
  id: string;
  code: string;
}

interface RunRow {
  id: string;
  planogramId: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "DONE" | "ABANDONED";
  currentRealStep: number;
  realStepsTotal: number;
  startedAt: string | null;
  finishedAt: string | null;
  feedbackCount: number;
  allFeedbackAnswered: boolean;
  user: { email: string; name: string | null };
  planogram: { node: string; store: { code: string } };
}

const ONLY_WITH_FEEDBACK_KEY = "analytics.onlyWithFeedback";
const ONLY_NEEDING_REPLY_KEY = "analytics.onlyNeedingReply";

export default function AnalyticsPage() {
  const t = useTranslations("analytics");
  const locale = useLocale();
  const { data: session } = useSession();
  const role = session?.user?.role;
  const isAdmin = role === "ADMIN";
  // SPECIALIST sees every store's numbers, same as ADMIN — only STORE stays confined
  // to their own store (enforced server-side too, this just drives what's shown here).
  const canSeeAllStores = isAdmin || role === "SPECIALIST";
  const canReply = isAdmin || role === "SPECIALIST";

  const { data: summary } = useSWR<Summary>("/api/analytics/summary", fetcher);
  const { data: feedback, mutate: mutateFeedback } = useSWR<FeedbackRow[]>("/api/feedback", fetcher);
  const { data: stores } = useSWR<Store[]>(canSeeAllStores ? "/api/stores" : null, fetcher);
  const { data: categories } = useSWR<CategoryWithNodes[]>("/api/categories", fetcher);

  function planogramLabel(node: string) {
    const nodeName = resolveNodeCategory(categories ?? [], node, locale)?.nodeName;
    return nodeName ? `${node} — ${nodeName}` : node;
  }

  const [storeId, setStoreId] = useState("");
  const runsUrl = storeId ? `/api/analytics/runs?storeId=${storeId}` : "/api/analytics/runs";
  const { data: runs, mutate: mutateRuns } = useSWR<RunRow[]>(runsUrl, fetcher);

  const [onlyWithFeedback, setOnlyWithFeedback] = useState(
    () => typeof window !== "undefined" && localStorage.getItem(ONLY_WITH_FEEDBACK_KEY) === "1"
  );
  useEffect(() => {
    localStorage.setItem(ONLY_WITH_FEEDBACK_KEY, onlyWithFeedback ? "1" : "0");
  }, [onlyWithFeedback]);

  const [onlyNeedingReply, setOnlyNeedingReply] = useState(
    () => typeof window !== "undefined" && localStorage.getItem(ONLY_NEEDING_REPLY_KEY) === "1"
  );
  useEffect(() => {
    localStorage.setItem(ONLY_NEEDING_REPLY_KEY, onlyNeedingReply ? "1" : "0");
  }, [onlyNeedingReply]);

  let visibleRuns = runs;
  if (onlyWithFeedback) visibleRuns = visibleRuns?.filter((r) => r.feedbackCount > 0);
  // "needs a reply" implies "has feedback" — checking both at once is just redundant, not conflicting.
  if (onlyNeedingReply) visibleRuns = visibleRuns?.filter((r) => r.feedbackCount > 0 && !r.allFeedbackAnswered);

  const [feedbackModal, setFeedbackModal] = useState<{ title: string; planogramId: string } | null>(null);

  return (
    <main className={styles.page}>
      <PageHeader title={t("title")} />

      <TopNav />

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

          {canSeeAllStores && (
            <div className={styles.card}>
              <h2 className={styles.subtitle}>{t("byStoreTitle")}</h2>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>{t("byStoreTable.store")}</th>
                      <th>{t("byStoreTable.done")}</th>
                      <th>{t("byStoreTable.inProgress")}</th>
                      <th>{t("byStoreTable.notStarted")}</th>
                      <th>{t("byStoreTable.total")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.byStore.map((s) => (
                      <tr key={s.storeCode}>
                        <td>{s.storeCode}</td>
                        <td>{s.done}</td>
                        <td>{s.inProgress}</td>
                        <td>{s.notStarted}</td>
                        <td>{s.total}</td>
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
        {canSeeAllStores && (
          <select className={styles.select} value={storeId} onChange={(e) => setStoreId(e.target.value)}>
            <option value="">{t("allStores")}</option>
            {stores?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code}
              </option>
            ))}
          </select>
        )}

        <label className={styles.filterRow}>
          <span className={styles.filterLabel}>{t("onlyWithFeedback")}</span>
          <span className={styles.switch}>
            <input
              type="checkbox"
              className={styles.switchInput}
              checked={onlyWithFeedback}
              onChange={(e) => setOnlyWithFeedback(e.target.checked)}
            />
            <span className={styles.switchTrack} />
          </span>
        </label>

        <label className={styles.filterRow}>
          <span className={styles.filterLabel}>{t("onlyNeedingReply")}</span>
          <span className={styles.switch}>
            <input
              type="checkbox"
              className={styles.switchInput}
              checked={onlyNeedingReply}
              onChange={(e) => setOnlyNeedingReply(e.target.checked)}
            />
            <span className={styles.switchTrack} />
          </span>
        </label>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t("runsTable.store")}</th>
                <th>{t("runsTable.planogram")}</th>
                <th>{t("runsTable.duration")}</th>
                <th>{t("runsTable.started")}</th>
                <th>{t("runsTable.finished")}</th>
                <th>{t("runsTable.feedbackCount")}</th>
              </tr>
            </thead>
            <tbody>
              {visibleRuns?.map((r) => {
                const durationMinutes =
                  r.startedAt && r.finishedAt
                    ? Math.round(
                        ((new Date(r.finishedAt).getTime() - new Date(r.startedAt).getTime()) / 60000) * 10
                      ) / 10
                    : null;
                const rowClass =
                  r.feedbackCount > 0
                    ? r.allFeedbackAnswered
                      ? styles.rowFeedbackAnswered
                      : styles.rowWithFeedback
                    : undefined;
                return (
                  <tr key={r.id} className={rowClass}>
                    <td>{r.planogram.store.code}</td>
                    <td>{planogramLabel(r.planogram.node)}</td>
                    <td>{durationMinutes != null ? `${durationMinutes} ${t("minutesShort")}` : "—"}</td>
                    <td>{r.startedAt ? new Date(r.startedAt).toLocaleString(locale) : "—"}</td>
                    <td>{r.finishedAt ? new Date(r.finishedAt).toLocaleString(locale) : "—"}</td>
                    <td>
                      {r.feedbackCount > 0 ? (
                        <button
                          type="button"
                          className={styles.btnGhost}
                          onClick={() =>
                            setFeedbackModal({
                              planogramId: r.planogramId,
                              title: `${r.planogram.store.code} · ${planogramLabel(r.planogram.node)}`,
                            })
                          }
                        >
                          {r.feedbackCount}
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {visibleRuns?.length === 0 && <p className={styles.hintText}>{t("noRuns")}</p>}
      </div>

      {feedbackModal && (
        <FeedbackHistoryModal
          title={feedbackModal.title}
          items={(feedback ?? []).filter((f) => f.run.planogramId === feedbackModal.planogramId)}
          onClose={() => setFeedbackModal(null)}
          canReply={canReply}
          onUpdated={() => {
            mutateFeedback();
            mutateRuns();
          }}
        />
      )}
    </main>
  );
}

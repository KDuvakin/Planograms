"use client";

import { use } from "react";
import useSWR from "swr";
import { useTranslations } from "next-intl";
import type { PlanogramItemLike } from "@/lib/engine/loadProducts";
import { RunView } from "./RunView";
import styles from "./run.module.css";

interface PlanogramMeta {
  id: string;
  node: string;
  store: { code: string; name: string | null };
}

export interface RunRecord {
  id: string;
  planogramId: string;
  userId: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "DONE" | "ABANDONED";
  currentRealStep: number;
  realStepsTotal: number;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations("run");
  const tCommon = useTranslations("common");

  const { data: meta } = useSWR<PlanogramMeta>(`/api/planograms/${id}`, fetcher);
  const { data: items } = useSWR<PlanogramItemLike[]>(`/api/planograms/${id}/items`, fetcher);
  const { data: run } = useSWR<RunRecord>(`/api/planograms/${id}/run`, fetcher);

  if (!meta || !items || !run) {
    return <main className={styles.page}>{tCommon("loading")}</main>;
  }

  if (items.length === 0) {
    return <main className={styles.page}>{t("empty")}</main>;
  }

  return <RunView key={run.id} meta={meta} items={items} run={run} />;
}

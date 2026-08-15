"use client";

import { use, useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { createEngineState, rackNumbers, shelfNumbers, type EngineState } from "@/lib/engine";
import type { PlanogramItemLike } from "@/lib/engine/loadProducts";
import { RackTabs } from "@/components/run/RackTabs";
import { ShelfRow } from "@/components/run/ShelfRow";
import { DiffLegend } from "@/components/run/DiffLegend";
import styles from "./preview.module.css";

interface PlanogramMeta {
  id: string;
  node: string;
  version: number;
  sourceFileName: string;
  importedAt: string;
  store: { code: string; name: string | null };
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const SCALE = 3.2;

export default function PlanogramPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations("preview");
  const tCommon = useTranslations("common");
  const locale = useLocale();

  const { data: meta } = useSWR<PlanogramMeta>(`/api/planograms/${id}`, fetcher);
  const { data: items } = useSWR<PlanogramItemLike[]>(`/api/planograms/${id}/items`, fetcher);
  const { data: run } = useSWR<{ status: string; currentRealStep: number; realStepsTotal: number }>(
    `/api/planograms/${id}/run`,
    fetcher
  );

  const state: EngineState | null = useMemo(() => (items ? createEngineState(items) : null), [items]);
  const racks = useMemo(() => (state ? rackNumbers(state) : []), [state]);
  const [selectedRack, setSelectedRack] = useState<string | null>(null);
  const currentRack = selectedRack && racks.includes(selectedRack) ? selectedRack : racks[0];

  if (!meta || !state) {
    return <main className={styles.page}>{tCommon("loading")}</main>;
  }

  return (
    <main className={styles.page}>
      <Link href="/planograms" className={styles.back}>
        {t("back")}
      </Link>

      <header className={styles.header}>
        <div className={styles.store}>{meta.store.code}</div>
        <h1 className={styles.title}>{meta.node}</h1>
        <p className={styles.sub}>
          {t("importedMeta", {
            date: new Date(meta.importedAt).toLocaleDateString(locale),
            version: meta.version,
          })}
        </p>
      </header>

      <DiffLegend />

      {currentRack && (
        <>
          <RackTabs racks={racks} current={currentRack} onSelect={setSelectedRack} />
          <div className={styles.shelves}>
            {shelfNumbers(state, currentRack).map((shelf) => (
              <ShelfRow
                key={shelf}
                shelfNum={shelf}
                items={state.racks[currentRack][shelf].items}
                scale={SCALE}
              />
            ))}
          </div>
        </>
      )}

      <div className={styles.actions}>
        <Link href={`/planograms/${id}/run`} className={styles.startBtn}>
          {run && run.status === "IN_PROGRESS" && run.currentRealStep > 0
            ? t("continueFromStep", { step: run.currentRealStep })
            : t("start")}
        </Link>
        <Link href="/planograms" className={styles.cancelBtn}>
          {tCommon("cancel")}
        </Link>
      </div>
    </main>
  );
}

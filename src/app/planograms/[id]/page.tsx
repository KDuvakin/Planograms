"use client";

import { use, useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { createEngineState, rackNumbers, shelfNumbers, type EngineState } from "@/lib/engine";
import type { PlanogramItemLike } from "@/lib/engine/loadProducts";
import { RackTabs } from "@/components/run/RackTabs";
import { ShelfRow } from "@/components/run/ShelfRow";
import { DiffLegend } from "@/components/run/DiffLegend";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { resolveNodeCategory, type CategoryWithNodes } from "@/lib/nodeCategory";
import styles from "./preview.module.css";
import { fetcher } from "@/lib/swrFetcher";

interface PlanogramMeta {
  id: string;
  node: string;
  version: number;
  sourceFileName: string;
  importedAt: string;
  store: { code: string; name: string | null };
}

const SCALE = 3.2;

export default function PlanogramPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations("preview");
  const tCommon = useTranslations("common");
  const tRun = useTranslations("run");
  const locale = useLocale();
  const router = useRouter();
  const [starting, setStarting] = useState(false);

  const { data: meta } = useSWR<PlanogramMeta>(`/api/planograms/${id}`, fetcher);
  const { data: items } = useSWR<PlanogramItemLike[]>(`/api/planograms/${id}/items`, fetcher);
  const { data: categories } = useSWR<CategoryWithNodes[]>("/api/categories", fetcher);
  const { data: run } = useSWR<{ status: string; currentRealStep: number; realStepsTotal: number }>(
    `/api/planograms/${id}/run`,
    fetcher
  );

  const state: EngineState | null = useMemo(() => (items ? createEngineState(items) : null), [items]);
  const racks = useMemo(() => (state ? rackNumbers(state) : []), [state]);
  const [selectedRack, setSelectedRack] = useState<string | null>(null);
  const currentRack = selectedRack && racks.includes(selectedRack) ? selectedRack : racks[0];
  const rackIndex = currentRack ? racks.indexOf(currentRack) : -1;

  const canResume = !!run && run.status === "IN_PROGRESS" && run.currentRealStep > 0;

  async function handleStart() {
    setStarting(true);
    try {
      await fetch(`/api/planograms/${id}/run/restart`, { method: "POST" });
      router.push(`/planograms/${id}/run`);
    } catch {
      setStarting(false);
    }
  }

  if (!meta || !state) {
    return <main className={styles.page}>{tCommon("loading")}</main>;
  }

  const category = resolveNodeCategory(categories ?? [], meta.node, locale);

  return (
    <main className={styles.page}>
      <div className={styles.topRow}>
        <Link href="/planograms" className={styles.back}>
          {t("back")}
        </Link>
        <LanguageSwitcher />
      </div>

      <header className={styles.header}>
        <div className={styles.store}>{meta.store.code}</div>
        {category && (
          <div className={styles.categoryBreadcrumb}>
            <span>{category.categoryIcon}</span>
            <span>
              {category.categoryName}
              {category.nodeName ? ` → ${category.nodeName}` : ""}
            </span>
          </div>
        )}
      </header>

      {rackIndex >= 0 && (
        <div className={styles.rackHeading}>
          {tRun("rackCounter", { current: rackIndex + 1, total: racks.length })}
        </div>
      )}

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

      <p className={styles.releaseDate}>
        {t("releaseDate", { date: new Date(meta.importedAt).toLocaleDateString(locale) })}
      </p>

      <div className={styles.actions}>
        <button type="button" className={styles.startBtn} disabled={starting} onClick={handleStart}>
          {t("start")}
        </button>
        <div className={styles.secondaryRow}>
          <Link href="/planograms" className={styles.cancelBtn}>
            {tCommon("cancel")}
          </Link>
          {canResume && (
            <Link href={`/planograms/${id}/run`} className={styles.continueBtn}>
              {t("continueFromStep", { step: run!.currentRealStep })}
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}

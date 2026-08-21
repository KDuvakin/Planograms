"use client";

import { use, useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  createEngineState,
  isGap,
  mirrorRackLabel,
  rackNumbers,
  racksWithChanges,
  shelfNumbers,
  type EngineState,
  type Product,
  type ShelfSlot,
} from "@/lib/engine";
import type { PlanogramItemLike } from "@/lib/engine/loadProducts";
import { RackTabs } from "@/components/run/RackTabs";
import { ShelfRow } from "@/components/run/ShelfRow";
import { DiffLegend } from "@/components/run/DiffLegend";
import { ProductDetailModal } from "@/components/run/ProductDetailModal";
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
  mirrored: boolean;
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

  const { data: meta, mutate: mutateMeta } = useSWR<PlanogramMeta>(`/api/planograms/${id}`, fetcher);
  const { data: items } = useSWR<PlanogramItemLike[]>(`/api/planograms/${id}/items`, fetcher);
  const { data: categories } = useSWR<CategoryWithNodes[]>("/api/categories", fetcher);
  const { data: run } = useSWR<{ status: string; currentRealStep: number; realStepsTotal: number }>(
    `/api/planograms/${id}/run`,
    fetcher
  );

  const state: EngineState | null = useMemo(
    () => (items ? createEngineState(items, meta?.mirrored ?? false) : null),
    [items, meta?.mirrored]
  );
  const racks = useMemo(() => (state ? rackNumbers(state) : []), [state]);
  const changedRacks = useMemo(() => (state ? racksWithChanges(state) : new Set<string>()), [state]);
  // Mirroring flips the whole planogram, not just each shelf on its own — the last rack
  // becomes the first one browsed, matching how a mirrored store is actually walked.
  const orderedRacks = meta?.mirrored ? [...racks].reverse() : racks;
  const [selectedRack, setSelectedRack] = useState<string | null>(null);
  const currentRack = selectedRack && orderedRacks.includes(selectedRack) ? selectedRack : orderedRacks[0];
  const rackIndex = currentRack ? orderedRacks.indexOf(currentRack) : -1;
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  function handleSelectSlot(slot: ShelfSlot) {
    if (!isGap(slot)) setSelectedProduct(slot);
  }

  const canResume = !!run && run.status === "IN_PROGRESS" && run.currentRealStep > 0;

  async function handleToggleMirrored(checked: boolean) {
    await fetch(`/api/planograms/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mirrored: checked }),
    });
    mutateMeta();
  }

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

      <div className={styles.rackHeadingRow}>
        {rackIndex >= 0 && currentRack && (
          <div className={styles.rackHeading}>
            {tRun("rackCounter", {
              current: mirrorRackLabel(currentRack, racks, meta.mirrored),
              total: orderedRacks.length,
            })}
          </div>
        )}
        <label className={styles.mirrorRow}>
          <span className={styles.mirrorLabel}>{t("mirrorToggle")}</span>
          <span className={styles.switch}>
            <input
              type="checkbox"
              className={styles.switchInput}
              checked={meta.mirrored}
              onChange={(e) => handleToggleMirrored(e.target.checked)}
            />
            <span className={styles.switchTrack} />
          </span>
        </label>
      </div>

      <DiffLegend />

      {currentRack && (
        <>
          <RackTabs
            racks={orderedRacks}
            current={currentRack}
            onSelect={setSelectedRack}
            changedRacks={changedRacks}
            allRacks={racks}
            mirrored={meta.mirrored}
          />
          <div className={styles.shelves}>
            {shelfNumbers(state, currentRack).map((shelf) => (
              <ShelfRow
                key={shelf}
                shelfNum={shelf}
                items={state.racks[currentRack][shelf].items}
                scale={SCALE}
                mirrored={meta.mirrored}
                onSelectProduct={handleSelectSlot}
              />
            ))}
          </div>
        </>
      )}

      <p className={styles.releaseDate}>
        {t("releaseDate", { date: new Date(meta.importedAt).toLocaleDateString(locale) })}
      </p>

      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          racks={racks}
          mirrored={meta.mirrored}
          onClose={() => setSelectedProduct(null)}
        />
      )}

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

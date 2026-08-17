"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import useSWR from "swr";
import { rackNumbers, shelfNumbers } from "@/lib/engine";
import type { NavigatorKind } from "@/lib/engine";
import type { PlanogramItemLike } from "@/lib/engine/loadProducts";
import { createRunStore } from "@/lib/engine/runStore";
import { ShelfRow } from "@/components/run/ShelfRow";
import { ProductIcon } from "@/components/run/ProductIcon";
import { DiffLegend } from "@/components/run/DiffLegend";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { FeedbackDialog, type FeedbackProductInfo } from "@/components/run/FeedbackDialog";
import { CompletionScreen } from "@/components/run/CompletionScreen";
import { resolveNodeCategory, type CategoryWithNodes } from "@/lib/nodeCategory";
import { fetcher } from "@/lib/swrFetcher";
import type { RunRecord } from "./page";
import styles from "./run.module.css";
import runStyles from "@/components/run/run.module.css";

const SCALE = 3.2;
const ARROW_WIDTH = 26;

/** Which of the shared `ok/move/danger/new` state-color classes a step's kind renders in. */
const KIND_STATE_CLASS: Partial<Record<NavigatorKind, string>> = {
  delete: runStyles.danger,
  pick: runStyles.move,
  move: runStyles.move,
  resize: runStyles.move,
  place: runStyles.new,
  confirm: runStyles.ok,
  done: runStyles.ok,
};

interface Meta {
  id: string;
  node: string;
  store: { code: string; name: string | null };
}

function patchRun(runId: string, body: Partial<Pick<RunRecord, "currentRealStep" | "realStepsTotal" | "status">>) {
  return fetch(`/api/runs/${runId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {
    // best-effort — progress is re-derived from the same deterministic plan on next load, worst
    // case the user re-does the last click
  });
}

export function RunView({
  meta,
  items,
  run,
}: {
  meta: Meta;
  items: PlanogramItemLike[];
  run: RunRecord;
}) {
  const t = useTranslations("run");
  const tCommon = useTranslations("common");
  const tStepLabel = useTranslations("stepLabel");
  const tInstructions = useTranslations("instructions");
  const locale = useLocale();
  const router = useRouter();
  const { data: session } = useSession();
  const [useRunState] = useState(() => createRunStore(items, run.currentRealStep));
  const state = useRunState();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackCount, setFeedbackCount] = useState(0);
  const [rackTransition, setRackTransition] = useState<{ completedRack: string; nextRack: string } | null>(null);
  const { data: categories } = useSWR<CategoryWithNodes[]>("/api/categories", fetcher);
  const category = resolveNodeCategory(categories ?? [], meta.node, locale);

  // Tracks the actual on-screen position of the highlighted shelf slot so the down-arrow
  // can point at it precisely, even when the item sits near either end of the shelf and
  // can't be scrolled all the way to the horizontal center.
  const arrowTrackRef = useRef<HTMLDivElement>(null);
  const [arrowLeft, setArrowLeft] = useState<number | null>(null);
  const handleHighlightRectChange = useCallback((rect: DOMRect | null) => {
    const track = arrowTrackRef.current;
    if (!track) return;
    const trackRect = track.getBoundingClientRect();
    if (!rect) {
      setArrowLeft(null);
      return;
    }
    const blockCenter = rect.left + rect.width / 2 - trackRect.left;
    const clamped = Math.min(
      Math.max(blockCenter - ARROW_WIDTH / 2, 4),
      Math.max(trackRect.width - ARROW_WIDTH - 4, 4)
    );
    setArrowLeft(clamped);
  }, []);

  // Mark the run IN_PROGRESS as soon as the screen opens (once per run id).
  const startedRunId = useRef<string | null>(null);
  useEffect(() => {
    if (startedRunId.current === run.id) return;
    startedRunId.current = run.id;
    if (run.status === "NOT_STARTED") {
      patchRun(run.id, { status: "IN_PROGRESS", realStepsTotal: state.realStepsTotal });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run.id]);

  // Persist progress every time the real step count changes (skip the very first render,
  // which is just the resumed/initial state already reflected by `run`).
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const status = state.currentRealStep >= state.realStepsTotal ? "DONE" : "IN_PROGRESS";
    patchRun(run.id, {
      currentRealStep: state.currentRealStep,
      realStepsTotal: state.realStepsTotal,
      status,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.currentRealStep, state.realStepsTotal]);

  const racks = rackNumbers(state);

  const lastExecutedStep = state.currentStep > 0 ? state.steps[state.currentStep - 1] : null;
  const focusRack = lastExecutedStep?.rack ?? racks[0] ?? null;
  const rackIndex = focusRack ? racks.indexOf(focusRack) : -1;

  const isDone = state.currentRealStep >= state.realStepsTotal;
  const progressPct = state.realStepsTotal ? Math.round((state.currentRealStep / state.realStepsTotal) * 100) : 0;

  if (isDone) {
    const placedCount = state.steps.filter(
      (s) => s.type === "move" || s.type === "place" || s.type === "resize"
    ).length;
    const removedCount = state.steps.filter((s) => s.type === "evict" && s.to === "deleted").length;

    return (
      <CompletionScreen
        placedCount={placedCount}
        removedCount={removedCount}
        feedbackCount={feedbackCount}
        totalSteps={state.realStepsTotal}
        userName={session?.user?.name ?? session?.user?.email ?? ""}
        onDone={() => router.push("/planograms")}
      />
    );
  }

  // Advances to the next real step — unless it would move onto a different rack,
  // in which case it first shows a "rack complete" summary and waits for a second click.
  function handleNext() {
    if (rackTransition) {
      setRackTransition(null);
      state.nextStep();
      return;
    }
    if (lastExecutedStep) {
      const nextRealStep = state.currentRealStep + 1;
      const upcomingStep =
        nextRealStep <= state.realStepsTotal ? state.steps[state.clickBoundaries[nextRealStep] - 1] : null;
      if (upcomingStep && upcomingStep.rack !== lastExecutedStep.rack) {
        setRackTransition({ completedRack: lastExecutedStep.rack, nextRack: upcomingStep.rack });
        return;
      }
    }
    state.nextStep();
  }

  if (rackTransition) {
    return (
      <main className={styles.page}>
        <div className={styles.topRow}>
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

        <p className={styles.subtitle}>{t("rackCompleteTitle", { rack: rackTransition.completedRack })}</p>

        <div className={styles.rackHeading}>
          {t("rackCounter", { current: racks.indexOf(rackTransition.nextRack) + 1, total: racks.length })}
        </div>

        <DiffLegend />

        {/* Steps for this rack haven't executed yet, so its shelves still show the pre-reset diff. */}
        {shelfNumbers(state, rackTransition.nextRack).map((shelf) => (
          <ShelfRow
            key={shelf}
            shelfNum={shelf}
            items={state.racks[rackTransition.nextRack][shelf].items}
            scale={SCALE}
          />
        ))}

        <div className={styles.controls}>
          <div className={styles.controlsRow}>
            <button type="button" className={styles.btnPrimary} onClick={handleNext}>
              {t("continueToRack", { rack: rackTransition.nextRack })}
            </button>
          </div>
        </div>
      </main>
    );
  }

  const feedbackProduct: FeedbackProductInfo | null = lastExecutedStep
    ? {
        id: lastExecutedStep.product.id,
        article: lastExecutedStep.product.article,
        sap: lastExecutedStep.product.sap,
        ean: lastExecutedStep.product.ean,
        rack: lastExecutedStep.rack,
        shelf: lastExecutedStep.shelf,
        positionNumber: lastExecutedStep.product.positionNumberNew,
        faces: lastExecutedStep.product.facesNew,
        isNew: lastExecutedStep.product.isNew,
      }
    : null;

  const kindStateClass = lastExecutedStep ? KIND_STATE_CLASS[state.navigator.kind] : undefined;

  return (
    <main className={styles.page}>
      <div className={styles.topRow}>
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
        {rackIndex >= 0 && (
          <div className={styles.rackHeading}>{t("rackCounter", { current: rackIndex + 1, total: racks.length })}</div>
        )}
      </header>

      <DiffLegend />

      <div className={styles.stepHeading}>
        {t("stepCounter", { current: state.currentRealStep, total: state.realStepsTotal })}
      </div>
      <div className={styles.progressTrack}>
        <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
      </div>

      {lastExecutedStep && (
        <>
          <section className={`${runStyles.productPanel} ${kindStateClass ?? ""}`}>
            <ProductIcon className={runStyles.productIcon} />
            <div className={runStyles.productInfo}>
              <div className={runStyles.infoRow}>
                <span className={runStyles.infoLabel}>{t("productLabel")}</span>
                <span className={runStyles.infoValue}>{lastExecutedStep.product.article}</span>
              </div>
              <div className={runStyles.infoRow}>
                <span className={runStyles.infoLabel}>{t("sapCodeLabel")}</span>
                <span className={runStyles.infoValue}>{lastExecutedStep.product.sap}</span>
              </div>
              {lastExecutedStep.product.ean && (
                <div className={runStyles.infoRow}>
                  <span className={runStyles.infoLabel}>{t("eanCodeLabel")}</span>
                  <span className={runStyles.infoValue}>{lastExecutedStep.product.ean}</span>
                </div>
              )}
            </div>
          </section>

          <div className={runStyles.arrowTrack} ref={arrowTrackRef}>
            <svg
              className={runStyles.arrowDown}
              style={arrowLeft !== null ? { left: arrowLeft } : undefined}
              width="26"
              height="30"
              viewBox="0 0 28 30"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M10 0H18V15H26L14 29L2 15H10V0Z" />
            </svg>
          </div>

          <ShelfRow
            shelfNum={lastExecutedStep.shelf}
            items={state.racks[lastExecutedStep.rack][lastExecutedStep.shelf].items}
            scale={SCALE}
            highlightIndex={lastExecutedStep.product.index}
            onHighlightRectChange={handleHighlightRectChange}
          />
        </>
      )}

      <section className={styles.instructionCard} data-kind={state.navigator.kind}>
        <div className={styles.instructionTag}>{tStepLabel(state.navigator.kind)}</div>
        <div className={runStyles.stepDescLabel}>{t("stepDescriptionLabel")}</div>
        <p className={styles.instructionText}>{tInstructions(state.navigator.key, state.navigator.params)}</p>
      </section>

      <div className={styles.controls}>
        <div className={styles.controlsRow}>
          <button
            type="button"
            className={styles.btnGhost}
            disabled={state.currentRealStep <= 0}
            onClick={() => state.prevStep()}
          >
            {t("backWithStep", { step: Math.max(state.currentRealStep - 1, 0), total: state.realStepsTotal })}
          </button>
          <button type="button" className={styles.btnPrimary} onClick={handleNext}>
            {t("nextWithStep", {
              step: Math.min(state.currentRealStep + 1, state.realStepsTotal),
              total: state.realStepsTotal,
            })}
          </button>
        </div>
        <div className={styles.controlsRow}>
          <Link href={`/planograms/${meta.id}`} className={styles.cancelBtn}>
            {tCommon("cancel")}
          </Link>
          <button type="button" className={styles.feedbackBtn} onClick={() => setFeedbackOpen(true)}>
            {t("feedback")}
          </button>
        </div>
      </div>

      {feedbackOpen && (
        <FeedbackDialog
          runId={run.id}
          stepRealIndex={state.currentRealStep}
          product={feedbackProduct}
          onClose={() => setFeedbackOpen(false)}
          onSubmitted={() => setFeedbackCount((n) => n + 1)}
        />
      )}
    </main>
  );
}

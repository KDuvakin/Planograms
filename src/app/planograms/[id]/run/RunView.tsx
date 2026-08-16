"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { rackNumbers, shelfNumbers } from "@/lib/engine";
import type { NavigatorKind } from "@/lib/engine";
import type { PlanogramItemLike } from "@/lib/engine/loadProducts";
import { createRunStore } from "@/lib/engine/runStore";
import { ShelfRow } from "@/components/run/ShelfRow";
import { ProductIcon } from "@/components/run/ProductIcon";
import { DiffLegend } from "@/components/run/DiffLegend";
import { FeedbackDialog, type FeedbackProductInfo } from "@/components/run/FeedbackDialog";
import { CompletionScreen } from "@/components/run/CompletionScreen";
import { categoryForNode } from "@/lib/categories";
import type { RunRecord } from "./page";
import styles from "./run.module.css";
import runStyles from "@/components/run/run.module.css";

const SCALE = 3.2;

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
  const tCategories = useTranslations("categories");
  const router = useRouter();
  const { data: session } = useSession();
  const [useRunState] = useState(() => createRunStore(items, run.currentRealStep));
  const state = useRunState();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackCount, setFeedbackCount] = useState(0);
  const [rackTransition, setRackTransition] = useState<{ completedRack: string; nextRack: string } | null>(null);
  const category = categoryForNode(meta.node);

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
        <header className={styles.header}>
          <div className={styles.store}>{meta.store.code}</div>
          {category && (
            <div className={styles.categoryBreadcrumb}>
              <span>{category.icon}</span>
              <span>
                {tCategories(`departments.${category.departmentKey}`)} →{" "}
                {tCategories(`subcategories.${category.subcategoryKey}`)}
              </span>
            </div>
          )}
          <h1 className={styles.title}>{meta.node}</h1>
        </header>

        <div className={styles.stepHeading}>{t("rackCompleteTitle", { rack: rackTransition.completedRack })}</div>

        {shelfNumbers(state, rackTransition.completedRack).map((shelf) => (
          <ShelfRow
            key={shelf}
            shelfNum={shelf}
            items={state.racks[rackTransition.completedRack][shelf].items}
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
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div>
            <div className={styles.store}>{meta.store.code}</div>
            {category && (
              <div className={styles.categoryBreadcrumb}>
                <span>{category.icon}</span>
                <span>
                  {tCategories(`departments.${category.departmentKey}`)} →{" "}
                  {tCategories(`subcategories.${category.subcategoryKey}`)}
                </span>
              </div>
            )}
            <h1 className={styles.title}>{meta.node}</h1>
            <p className={styles.subtitle}>{tCommon("planogramSubtitle")}</p>
          </div>
        </div>
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

          <div className={runStyles.arrowDown}>▾</div>

          <ShelfRow
            shelfNum={lastExecutedStep.shelf}
            items={state.racks[lastExecutedStep.rack][lastExecutedStep.shelf].items}
            scale={SCALE}
            highlightIndex={lastExecutedStep.product.index}
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

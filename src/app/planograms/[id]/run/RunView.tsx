"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { rackNumbers, shelfNumbers } from "@/lib/engine";
import type { PlanogramItemLike } from "@/lib/engine/loadProducts";
import { createRunStore } from "@/lib/engine/runStore";
import { RackTabs } from "@/components/run/RackTabs";
import { ShelfRow } from "@/components/run/ShelfRow";
import { FeedbackDialog, type FeedbackProductInfo } from "@/components/run/FeedbackDialog";
import { CompletionScreen } from "@/components/run/CompletionScreen";
import type { RunRecord } from "./page";
import styles from "./run.module.css";

const SCALE = 3.2;

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
  const router = useRouter();
  const { data: session } = useSession();
  const [useRunState] = useState(() => createRunStore(items, run.currentRealStep));
  const state = useRunState();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackCount, setFeedbackCount] = useState(0);

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

  // "Adjust state during render" (react.dev pattern) instead of an effect: whenever
  // the real step count changes, snap the rack tabs back to wherever that step
  // happened, while still letting the user freely browse other racks in between.
  const [trackedRealStep, setTrackedRealStep] = useState(state.currentRealStep);
  const [selectedRack, setSelectedRack] = useState<string | null>(focusRack);
  if (trackedRealStep !== state.currentRealStep) {
    setTrackedRealStep(state.currentRealStep);
    setSelectedRack(focusRack);
  }

  const currentRack = selectedRack && racks.includes(selectedRack) ? selectedRack : racks[0];
  const rackIndex = currentRack ? racks.indexOf(currentRack) : -1;

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

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div>
            <div className={styles.store}>{meta.store.code}</div>
            <h1 className={styles.title}>{meta.node}</h1>
          </div>
        </div>
        {rackIndex >= 0 && (
          <div className={styles.rackCounter}>{t("rackCounter", { current: rackIndex + 1, total: racks.length })}</div>
        )}
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
        </div>
        <div className={styles.stepCounter}>
          {t("stepCounter", { current: state.currentRealStep, total: state.realStepsTotal })}
        </div>
      </header>

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
                highlightIndex={lastExecutedStep?.product.index}
              />
            ))}
          </div>
        </>
      )}

      <section className={styles.instructionCard} data-kind={state.navigator.kind}>
        <div className={styles.instructionTag}>{tStepLabel(state.navigator.kind)}</div>
        {lastExecutedStep && (
          <div className={styles.instructionProduct}>
            {lastExecutedStep.product.article}
            <span className={styles.instructionSap}>SAP {lastExecutedStep.product.sap}</span>
          </div>
        )}
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
            {t("back")}
          </button>
          <button type="button" className={styles.btnPrimary} onClick={() => state.nextStep()}>
            {t("next")}
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

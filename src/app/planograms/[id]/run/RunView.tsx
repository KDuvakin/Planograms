"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import useSWR from "swr";
import { isGap, mirrorRackLabel, rackNumbers, shelfNumbers } from "@/lib/engine";
import type { NavigatorText, Product, ShelfSlot } from "@/lib/engine";
import type { PlanogramItemLike } from "@/lib/engine/loadProducts";
import { createRunStore } from "@/lib/engine/runStore";
import { ShelfRow } from "@/components/run/ShelfRow";
import { ProductIcon } from "@/components/run/ProductIcon";
import { DiffLegend } from "@/components/run/DiffLegend";
import { ProductDetailModal } from "@/components/run/ProductDetailModal";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { FeedbackDialog, type FeedbackProductInfo } from "@/components/run/FeedbackDialog";
import { CompletionScreen } from "@/components/run/CompletionScreen";
import { resolveNodeCategory, type CategoryWithNodes } from "@/lib/nodeCategory";
import { fetcher } from "@/lib/swrFetcher";
import type { RunRecord } from "./page";
import styles from "./run.module.css";
import runStyles from "@/components/run/run.module.css";

const SCALE = 3.2;

type HighlightKind = "danger" | "move" | "new" | "ok";

/**
 * Which color a step's product panel / shelf arrow renders in — red for removing an
 * item, blue only for a genuinely brand-new item, amber for everything else that's
 * fundamentally "pick it up from here, put it down there" (temp-basket placement,
 * cross-shelf move, same-shelf move, resize).
 */
function highlightKindFor(navigator: NavigatorText): HighlightKind {
  switch (navigator.kind) {
    case "delete":
      return "danger";
    case "place":
      return navigator.key === "placeFromNew" ? "new" : "move";
    case "confirm":
    case "done":
      return "ok";
    default:
      return "move";
  }
}

const HIGHLIGHT_CLASS: Record<HighlightKind, string> = {
  danger: runStyles.danger,
  move: runStyles.move,
  new: runStyles.new,
  ok: runStyles.ok,
};

const HIGHLIGHT_COLOR_VAR: Record<HighlightKind, string> = {
  danger: "var(--danger)",
  move: "var(--move)",
  new: "var(--new)",
  ok: "var(--ok)",
};

const RACK_PARAM_KEYS = ["rack", "fromRack", "oldRack"] as const;

const SPEECH_LANG: Record<string, string> = { ru: "ru-RU", en: "en-US", et: "et-EE", lv: "lv-LV" };
const AUTO_ADVANCE_DELAY_MS = 3500;
const VOICE_ENABLED_KEY = "run.voiceEnabled";
const AUTO_ADVANCE_KEY = "run.autoAdvance";

/** The engine's instruction params always carry the TRUE rack id — this only swaps what's
 * shown in the rendered instruction text when the planogram is mirrored, same as every
 * other rack label on this screen. */
function mirrorNavigatorParams(
  params: Record<string, string | number> | undefined,
  racks: string[],
  mirrored: boolean
): Record<string, string | number> | undefined {
  if (!params || !mirrored) return params;
  const out = { ...params };
  for (const key of RACK_PARAM_KEYS) {
    if (typeof out[key] === "string") out[key] = mirrorRackLabel(out[key] as string, racks, true);
  }
  return out;
}

interface TtsSegment {
  text: string;
  lang?: string;
}

// Product names are Estonian regardless of what language the rest of the UI/voice is
// in — read them with the Estonian voice always, splitting the sentence into
// before/article/after so only that one piece gets the different voice. Falls back to
// one plain segment (current locale, unsplit) if the article can't be found verbatim
// in the rendered text (e.g. no navigator.params.article at all, on the idle/done screens).
function buildArticleSegments(text: string, article: string | undefined): TtsSegment[] {
  if (!article) return [{ text }];
  const idx = text.indexOf(article);
  if (idx === -1) return [{ text }];
  const before = text.slice(0, idx);
  const after = text.slice(idx + article.length);
  const segments: TtsSegment[] = [];
  if (before) segments.push({ text: before });
  segments.push({ text: article, lang: "et" });
  if (after) segments.push({ text: after });
  return segments;
}

/** Which of CLDR's three Russian plural categories a count falls into — 1/21/31... is
 * "one", 2-4/22-24... is "few" (except the 12-14 teens carve-out), everything else
 * (0, 5-20, 25+) is "many". */
function ruFacesCategory(n: number): "one" | "few" | "many" {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "one";
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return "few";
  return "many";
}

// "с 2-х лиц на 1 лицо", "с 1-го лица на 2 лица" — the FROM value takes a genitive-case
// digit suffix (-го/-х/-ти) the way Russian shorthand writes declined numerals, the TO
// value reads as a plain count. Only the ru locale's own templates reference these —
// harmless extra params for en/et/lv, which don't need this declension at all.
function ruFacesFromPhrase(n: number): string {
  const category = ruFacesCategory(n);
  if (category === "one") return `${n}-го лица`;
  if (category === "few") return `${n}-х лиц`;
  return `${n}-ти лиц`;
}

function ruFacesToPhrase(n: number): string {
  const category = ruFacesCategory(n);
  if (category === "one") return `${n} лицо`;
  if (category === "few") return `${n} лица`;
  return `${n} лиц`;
}

function withFacesPhrases(
  params: Record<string, string | number> | undefined
): Record<string, string | number> | undefined {
  if (!params) return params;
  const out = { ...params };
  if (typeof out.oldFaces === "number") out.oldFacesPhrase = ruFacesFromPhrase(out.oldFaces);
  if (typeof out.newFaces === "number") out.newFacesPhrase = ruFacesToPhrase(out.newFaces);
  return out;
}

interface Meta {
  id: string;
  node: string;
  mirrored: boolean;
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
  const [useRunState] = useState(() => createRunStore(items, run.currentRealStep, meta.mirrored));
  const state = useRunState();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackCount, setFeedbackCount] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  function handleSelectSlot(slot: ShelfSlot) {
    if (!isGap(slot)) setSelectedProduct(slot);
  }
  const [rackTransition, setRackTransition] = useState<{ completedRack: string; nextRack: string } | null>(null);
  const { data: categories } = useSWR<CategoryWithNodes[]>("/api/categories", fetcher);
  const category = resolveNodeCategory(categories ?? [], meta.node, locale);

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
  // Before the first click there's no "current" step yet — fall back to whatever rack the
  // plan actually starts on (the true last rack when mirrored), not always racks[0].
  const focusRack = lastExecutedStep?.rack ?? state.steps[0]?.rack ?? racks[0] ?? null;
  const rackIndex = focusRack ? racks.indexOf(focusRack) : -1;

  const isDone = state.currentRealStep >= state.realStepsTotal;
  const progressPct = state.realStepsTotal ? Math.round((state.currentRealStep / state.realStepsTotal) * 100) : 0;

  // Advances to the next real step — unless it would move onto a different rack,
  // in which case it first shows a "rack complete" summary and waits for a second click.
  // Defined before the `isDone` early return below (and before the voice hooks that call
  // it) purely so every hook in this component stays unconditional — this function itself
  // calls no hooks, so its position doesn't matter to React, only to the reader.
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

  // Same text the instruction card shows, whether that's a real step or the idle/done
  // placeholder — voice only ever gets SPOKEN for a real step (guarded separately below),
  // but the displayed text itself has always covered every navigator state.
  const instructionText = tInstructions(
    state.navigator.key,
    withFacesPhrases(mirrorNavigatorParams(state.navigator.params, racks, meta.mirrored))
  );
  const articleName = typeof state.navigator.params?.article === "string" ? state.navigator.params.article : undefined;
  const ttsSegments = buildArticleSegments(instructionText, articleName);

  const [voiceEnabled, setVoiceEnabled] = useState(
    () => typeof window !== "undefined" && localStorage.getItem(VOICE_ENABLED_KEY) === "1"
  );
  const [autoAdvance, setAutoAdvance] = useState(
    () => typeof window !== "undefined" && localStorage.getItem(AUTO_ADVANCE_KEY) === "1"
  );
  const [autoPaused, setAutoPaused] = useState(false);
  const autoTimeoutRef = useRef<number | null>(null);
  // onend/onerror/onended fire asynchronously, possibly well after this render — refs
  // (not the state values themselves) are what those callbacks must read, so a
  // mid-speech toggle of "Авто"/"Пауза" takes effect immediately instead of using
  // whatever was true when the utterance/audio started.
  const autoAdvanceRef = useRef(autoAdvance);
  const autoPausedRef = useRef(autoPaused);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ttsAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    localStorage.setItem(VOICE_ENABLED_KEY, voiceEnabled ? "1" : "0");
  }, [voiceEnabled]);
  useEffect(() => {
    localStorage.setItem(AUTO_ADVANCE_KEY, autoAdvance ? "1" : "0");
    autoAdvanceRef.current = autoAdvance;
  }, [autoAdvance]);
  useEffect(() => {
    autoPausedRef.current = autoPaused;
  }, [autoPaused]);

  function handleVoiceEnabledChange(checked: boolean) {
    setVoiceEnabled(checked);
    if (!checked) setAutoAdvance(false); // no point leaving auto-advance armed with voice off
  }

  function handleAutoAdvanceChange(checked: boolean) {
    setAutoAdvance(checked);
    if (checked) setAutoPaused(false); // turning it on should always start running, not paused
  }

  function stopVoiceCycle() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    if (ttsAbortRef.current) {
      ttsAbortRef.current.abort();
      ttsAbortRef.current = null;
    }
    if (audioRef.current) {
      // strip handlers first — otherwise pausing/discarding mid-playback can itself
      // fire onended/onerror and schedule an auto-advance for a cycle we're cancelling
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.pause();
      URL.revokeObjectURL(audioRef.current.src);
      audioRef.current = null;
    }
    if (autoTimeoutRef.current !== null) {
      window.clearTimeout(autoTimeoutRef.current);
      autoTimeoutRef.current = null;
    }
  }

  function scheduleAutoAdvance() {
    if (autoAdvanceRef.current && !autoPausedRef.current) {
      autoTimeoutRef.current = window.setTimeout(() => {
        autoTimeoutRef.current = null;
        handleNext();
      }, AUTO_ADVANCE_DELAY_MS);
    }
  }

  function speakWithBrowserVoice(text: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = SPEECH_LANG[locale] ?? "ru-RU";
    utterance.onend = scheduleAutoAdvance;
    utterance.onerror = scheduleAutoAdvance; // don't get stuck waiting forever if TTS fails
    window.speechSynthesis.speak(utterance);
  }

  // Speaks `segments` through the server's Azure AI voice (each segment can carry its
  // own language — that's how a product's Estonian name stays Estonian regardless of
  // the surrounding sentence's locale), falling back to the browser's own (much lower
  // quality, single-voice, but zero-setup) voice reading `text` if that request fails
  // for any reason — no key configured, quota, network. Then — only if "Авто" is still
  // on and not paused by the time speech actually finishes — waits
  // AUTO_ADVANCE_DELAY_MS and clicks "Далее" on the caller's behalf. Used both for the
  // automatic per-step speech and for the manual "Повторить" button, so repeating
  // always restarts the same wait-then-advance cycle from scratch.
  async function runVoiceCycle(text: string, segments: TtsSegment[]) {
    stopVoiceCycle();
    if (!text) return;
    const controller = new AbortController();
    ttsAbortRef.current = controller;
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segments, locale }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`tts ${res.status}`);
      const blob = await res.blob();
      if (controller.signal.aborted) return; // superseded while the request was in flight
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      const onFinished = () => {
        URL.revokeObjectURL(url);
        audioRef.current = null;
        scheduleAutoAdvance();
      };
      audio.onended = onFinished;
      audio.onerror = onFinished;
      audioRef.current = audio;
      await audio.play();
    } catch {
      if (!controller.signal.aborted) speakWithBrowserVoice(text);
    }
  }

  // Speaks the current step automatically whenever it changes, while voice is on.
  useEffect(() => {
    if (!voiceEnabled || !lastExecutedStep || isDone || rackTransition) return;
    runVoiceCycle(instructionText, ttsSegments);
    return stopVoiceCycle;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceEnabled, autoAdvance, autoPaused, state.currentStep, isDone, rackTransition]);

  // Stop talking entirely once the reset is done or this screen unmounts.
  useEffect(() => stopVoiceCycle, []);

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

        <p className={styles.subtitle}>
          {t("rackCompleteTitle", { rack: mirrorRackLabel(rackTransition.completedRack, racks, meta.mirrored) })}
        </p>

        <div className={styles.rackHeading}>
          {t("rackCounter", {
            current: mirrorRackLabel(rackTransition.nextRack, racks, meta.mirrored),
            total: racks.length,
          })}
        </div>

        <DiffLegend />

        {/* Steps for this rack haven't executed yet, so its shelves still show the pre-reset diff. */}
        {shelfNumbers(state, rackTransition.nextRack).map((shelf) => (
          <ShelfRow
            key={shelf}
            shelfNum={shelf}
            items={state.racks[rackTransition.nextRack][shelf].items}
            scale={SCALE}
            mirrored={meta.mirrored}
            onSelectProduct={handleSelectSlot}
          />
        ))}

        <div className={styles.controls}>
          <div className={styles.controlsRow}>
            <button type="button" className={styles.btnPrimary} onClick={handleNext}>
              {t("continueToRack", { rack: mirrorRackLabel(rackTransition.nextRack, racks, meta.mirrored) })}
            </button>
          </div>
        </div>

        {selectedProduct && (
          <ProductDetailModal
            product={selectedProduct}
            racks={racks}
            mirrored={meta.mirrored}
            onClose={() => setSelectedProduct(null)}
          />
        )}
      </main>
    );
  }

  const feedbackProduct: FeedbackProductInfo | null = lastExecutedStep
    ? {
        id: lastExecutedStep.product.id,
        article: lastExecutedStep.product.article,
        sap: lastExecutedStep.product.sap,
        ean: lastExecutedStep.product.ean,
        rack: mirrorRackLabel(lastExecutedStep.rack, racks, meta.mirrored),
        shelf: lastExecutedStep.shelf,
        positionNumber: lastExecutedStep.product.positionNumberNew,
        faces: lastExecutedStep.product.facesNew,
        isNew: lastExecutedStep.product.isNew,
      }
    : null;

  const highlightKind = lastExecutedStep ? highlightKindFor(state.navigator) : undefined;
  const kindStateClass = highlightKind ? HIGHLIGHT_CLASS[highlightKind] : undefined;
  const highlightColor = highlightKind ? HIGHLIGHT_COLOR_VAR[highlightKind] : undefined;

  function handleRepeat() {
    runVoiceCycle(instructionText, ttsSegments);
  }

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
        {rackIndex >= 0 && focusRack && (
          <div className={styles.rackHeading}>
            {t("rackCounter", { current: mirrorRackLabel(focusRack, racks, meta.mirrored), total: racks.length })}
          </div>
        )}
      </header>

      <DiffLegend />

      <label className={styles.voiceRow}>
        <span className={styles.filterLabel}>{t("voiceAssistant")}</span>
        <span className={styles.switch}>
          <input
            type="checkbox"
            className={styles.switchInput}
            checked={voiceEnabled}
            onChange={(e) => handleVoiceEnabledChange(e.target.checked)}
          />
          <span className={styles.switchTrack} />
        </span>
      </label>

      {voiceEnabled && (
        <div className={styles.voiceControlsRow}>
          <button type="button" className={styles.voiceBtn} onClick={handleRepeat}>
            {t("repeat")}
          </button>
          <label className={styles.autoToggleRow}>
            <span className={styles.filterLabel}>{t("autoAdvance")}</span>
            <span className={styles.switch}>
              <input
                type="checkbox"
                className={styles.switchInput}
                checked={autoAdvance}
                onChange={(e) => handleAutoAdvanceChange(e.target.checked)}
              />
              <span className={styles.switchTrack} />
            </span>
          </label>
          {autoAdvance && (
            <button type="button" className={styles.voiceBtn} onClick={() => setAutoPaused((p) => !p)}>
              {autoPaused ? t("resume") : t("pause")}
            </button>
          )}
        </div>
      )}

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

          <ShelfRow
            shelfNum={lastExecutedStep.shelf}
            items={state.racks[lastExecutedStep.rack][lastExecutedStep.shelf].items}
            scale={SCALE}
            highlightIndex={lastExecutedStep.product.index}
            highlightColor={highlightColor}
            mirrored={meta.mirrored}
            onSelectProduct={handleSelectSlot}
          />
        </>
      )}

      <section className={styles.instructionCard} data-kind={state.navigator.kind}>
        <div className={styles.instructionTag}>{tStepLabel(state.navigator.kind)}</div>
        <div className={runStyles.stepDescLabel}>{t("stepDescriptionLabel")}</div>
        <p className={styles.instructionText}>{instructionText}</p>
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

      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          racks={racks}
          mirrored={meta.mirrored}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </main>
  );
}

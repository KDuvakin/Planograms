"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import styles from "./feedback.module.css";

const MAX_PHOTOS = 3;

export interface FeedbackProductInfo {
  id: string;
  article: string;
  sap: string;
  ean: string | null;
  rack: string;
  shelf: string;
  positionNumber: string;
  faces: number;
  isNew: boolean;
}

export function FeedbackDialog({
  runId,
  stepRealIndex,
  product,
  onClose,
  onSubmitted,
}: {
  runId: string;
  stepRealIndex: number;
  product: FeedbackProductInfo | null;
  onClose: () => void;
  onSubmitted?: () => void;
}) {
  const t = useTranslations("feedback");
  const tCommon = useTranslations("common");
  const [isShelfReady, setIsShelfReady] = useState(true);
  const [needSeparator, setNeedSeparator] = useState(false);
  const [doesntFitByHeight, setDoesntFitByHeight] = useState(false);
  const [doesntFitFacesQty, setDoesntFitFacesQty] = useState(false);
  const [otherReason, setOtherReason] = useState(false);
  const [comment, setComment] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function addPhotos(files: FileList | null) {
    if (!files) return;
    setPhotos((prev) => [...prev, ...Array.from(files)].slice(0, MAX_PHOTOS));
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const hasReason = needSeparator || doesntFitByHeight || doesntFitFacesQty || otherReason;
    if (!hasReason && !comment.trim()) {
      setError(t("validationError"));
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.set("runId", runId);
    formData.set("stepRealIndex", String(stepRealIndex));
    if (product) formData.set("planogramItemId", product.id);
    formData.set("isShelfReady", String(isShelfReady));
    formData.set("needSeparator", String(needSeparator));
    formData.set("doesntFitByHeight", String(doesntFitByHeight));
    formData.set("doesntFitFacesQty", String(doesntFitFacesQty));
    formData.set("otherReason", String(otherReason));
    formData.set("comment", comment.trim());
    photos.forEach((file) => formData.append("photos", file));

    const res = await fetch("/api/feedback", { method: "POST", body: formData });
    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: t("genericError") }));
      setError(body.error ?? t("genericError"));
      return;
    }
    setDone(true);
    onSubmitted?.();
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        {done ? (
          <>
            <p className={styles.doneText}>{t("sentThanks")}</p>
            <button type="button" className={styles.btnPrimary} onClick={onClose}>
              {tCommon("close")}
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            {product && (
              <div className={styles.productHeader}>
                {product.isNew && <span className={styles.newTag}>{t("newTag")}</span>}
                <div className={styles.productName}>{product.article}</div>
                <div className={styles.productMeta}>
                  SAP {product.sap}
                  {product.ean ? ` · EAN ${product.ean}` : ""}
                </div>
                <div className={styles.productMeta}>
                  {t("productLocation", {
                    rack: product.rack,
                    shelf: product.shelf,
                    position: product.positionNumber,
                    faces: product.faces,
                  })}
                </div>
              </div>
            )}

            <h2 className={styles.title}>{t("reasonTitle")}</h2>

            <label className={styles.toggleRow}>
              <span>{t("isShelfReady")}</span>
              <input
                type="checkbox"
                checked={isShelfReady}
                onChange={(e) => setIsShelfReady(e.target.checked)}
              />
            </label>

            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={needSeparator}
                onChange={(e) => setNeedSeparator(e.target.checked)}
              />
              {t("needSeparator")}
            </label>
            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={doesntFitByHeight}
                onChange={(e) => setDoesntFitByHeight(e.target.checked)}
              />
              {t("doesntFitByHeight")}
            </label>
            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={doesntFitFacesQty}
                onChange={(e) => setDoesntFitFacesQty(e.target.checked)}
              />
              {t("doesntFitFacesQty")}
            </label>
            <label className={styles.checkboxRow}>
              <input type="checkbox" checked={otherReason} onChange={(e) => setOtherReason(e.target.checked)} />
              {t("other")}
            </label>

            <textarea
              className={styles.textarea}
              placeholder={t("commentPlaceholder")}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
            />

            <div className={styles.photoRow}>
              {photos.map((file, i) => (
                <div key={i} className={styles.photoThumb}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={URL.createObjectURL(file)} alt="" />
                  <button type="button" className={styles.photoRemove} onClick={() => removePhoto(i)}>
                    ×
                  </button>
                </div>
              ))}
              {photos.length < MAX_PHOTOS && (
                <label className={styles.photoAdd} title={t("addPhoto")}>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={(e) => addPhotos(e.target.files)}
                  />
                  📷
                </label>
              )}
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <div className={styles.dialogActions}>
              <button type="button" className={styles.btnGhost} onClick={onClose}>
                {tCommon("cancel")}
              </button>
              <button type="submit" className={styles.btnPrimary} disabled={loading}>
                {loading ? t("submitting") : t("submit")}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

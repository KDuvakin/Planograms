"use client";

import { useTranslations } from "next-intl";
import type { Product } from "@/lib/engine";
import styles from "./run.module.css";

// Same state -> CSS-class mapping Block.tsx uses for the shelf block itself.
const STATE_CLASS: Record<Product["state"], string> = {
  correct: "ok",
  move: "move",
  deleted: "danger",
  new: "new",
  temp: "move",
};

// Same state -> legend copy the diff-preview's legend pills use ("changed"/"removed",
// not the internal "move"/"deleted" state names).
const LEGEND_KEY: Record<Product["state"], "ok" | "changed" | "new" | "removed"> = {
  correct: "ok",
  move: "changed",
  deleted: "removed",
  new: "new",
  temp: "changed",
};

/** Full product info on tap — the shelf block itself only has room for a truncated
 * SAP/name, so anything needing the rest (full name, EAN, before/after position) opens
 * this instead of relying on a native title-attribute tooltip. */
export function ProductDetailModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const t = useTranslations("run");
  const tCommon = useTranslations("common");
  const tLegend = useTranslations("preview.legend");
  const tFeedback = useTranslations("feedback");
  const tProductDetail = useTranslations("productDetail");

  const showOld = !product.isNew;
  const showNew = !product.isDeleted;

  return (
    <div className={styles.detailOverlay} onClick={onClose}>
      <div className={styles.detailDialog} onClick={(e) => e.stopPropagation()}>
        <span className={`${styles.legendPill} ${styles[STATE_CLASS[product.state]]}`}>
          {tLegend(LEGEND_KEY[product.state])}
        </span>

        <div className={styles.detailName}>{product.article}</div>

        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>{t("sapCodeLabel")}</span>
          <span className={styles.infoValue}>{product.sap}</span>
        </div>
        {product.ean && (
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>{t("eanCodeLabel")}</span>
            <span className={styles.infoValue}>{product.ean}</span>
          </div>
        )}

        {showOld && showNew && product.state === "move" && (
          <>
            <div className={styles.detailPositionLabel}>{tProductDetail("before")}</div>
            <p className={styles.detailPosition}>
              {tFeedback("productLocation", {
                rack: product.rackOld,
                shelf: product.shelfOld,
                position: product.positionNumberOld,
                faces: product.facesOld,
              })}
            </p>
            <div className={styles.detailPositionLabel}>{tProductDetail("after")}</div>
            <p className={styles.detailPosition}>
              {tFeedback("productLocation", {
                rack: product.rackNew,
                shelf: product.shelfNew,
                position: product.positionNumberNew,
                faces: product.facesNew,
              })}
            </p>
          </>
        )}
        {(!showOld || !showNew || product.state !== "move") && (
          <p className={styles.detailPosition}>
            {tFeedback("productLocation", {
              rack: showNew ? product.rackNew : product.rackOld,
              shelf: showNew ? product.shelfNew : product.shelfOld,
              position: showNew ? product.positionNumberNew : product.positionNumberOld,
              faces: showNew ? product.facesNew : product.facesOld,
            })}
          </p>
        )}

        <button type="button" className={styles.detailCloseBtn} onClick={onClose}>
          {tCommon("close")}
        </button>
      </div>
    </div>
  );
}

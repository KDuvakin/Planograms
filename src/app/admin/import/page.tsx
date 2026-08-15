"use client";

import { useState, type FormEvent } from "react";
import useSWR from "swr";
import { useTranslations } from "next-intl";
import styles from "./import.module.css";

interface Store {
  id: string;
  code: string;
  name: string | null;
}

interface ImportResult {
  store: string;
  results: Array<{ node: string; version: number; itemCount: number; duplicates: string[] }>;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function ImportPage() {
  const t = useTranslations("adminImport");
  const { data: stores, mutate } = useSWR<Store[]>("/api/stores", fetcher);
  const [storeId, setStoreId] = useState("");
  const [newStoreCode, setNewStoreCode] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function handleCreateStore() {
    const code = newStoreCode.trim();
    if (!code) return;
    setError(null);
    const res = await fetch("/api/stores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error ?? t("errors.createStoreFailed"));
      return;
    }
    setNewStoreCode("");
    await mutate();
    setStoreId(body.id);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!storeId || !file) return;

    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.set("storeId", storeId);
    formData.set("file", file);

    const res = await fetch("/api/admin/import", { method: "POST", body: formData });
    const body = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(body.error ?? t("errors.importFailed"));
      return;
    }
    setResult(body);
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>{t("title")}</h1>

      <section className={styles.card}>
        <h2 className={styles.subtitle}>{t("storeLabel")}</h2>
        <select className={styles.select} value={storeId} onChange={(e) => setStoreId(e.target.value)}>
          <option value="">{t("storePlaceholder")}</option>
          {stores?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.code}
              {s.name ? ` — ${s.name}` : ""}
            </option>
          ))}
        </select>

        <div className={styles.newStoreRow}>
          <input
            className={styles.input}
            placeholder={t("newStoreCodePlaceholder")}
            value={newStoreCode}
            onChange={(e) => setNewStoreCode(e.target.value)}
          />
          <button type="button" className={styles.btnGhost} onClick={handleCreateStore}>
            {t("createStore")}
          </button>
        </div>
      </section>

      <form className={styles.card} onSubmit={handleSubmit}>
        <h2 className={styles.subtitle}>{t("fileLabel")}</h2>
        <input
          className={styles.input}
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <p className={styles.hint}>{t("hint")}</p>

        {error && <p className={styles.error}>{error}</p>}

        <button className={styles.btnPrimary} type="submit" disabled={!storeId || !file || loading}>
          {loading ? t("submitting") : t("submit")}
        </button>
      </form>

      {result && (
        <section className={styles.card}>
          <h2 className={styles.subtitle}>{t("resultTitle", { store: result.store })}</h2>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t("table.node")}</th>
                <th>{t("table.version")}</th>
                <th>{t("table.items")}</th>
                <th>{t("table.duplicates")}</th>
              </tr>
            </thead>
            <tbody>
              {result.results.map((r) => (
                <tr key={r.node}>
                  <td>{r.node}</td>
                  <td>{r.version}</td>
                  <td>{r.itemCount}</td>
                  <td>{r.duplicates.length ? r.duplicates.join(", ") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}

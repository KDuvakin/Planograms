"use client";

import { useMemo, useState, type FormEvent } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/PageHeader";
import { TopNav } from "@/components/TopNav";
import styles from "./import.module.css";
import { fetcher } from "@/lib/swrFetcher";

interface Store {
  id: string;
  code: string;
  format: string | null;
}

interface ImportResult {
  format: string;
  storeCount: number;
  results: Array<{ store: string; node: string; version: number; itemCount: number; duplicates: string[] }>;
}

export default function ImportPage() {
  const t = useTranslations("adminImport");
  const { data: stores } = useSWR<Store[]>("/api/stores", fetcher);
  const [format, setFormat] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const formats = useMemo(() => {
    const set = new Set((stores ?? []).map((s) => s.format).filter((f): f is string => !!f));
    return Array.from(set).sort();
  }, [stores]);

  const storeCountForFormat = format ? (stores ?? []).filter((s) => s.format === format).length : 0;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!format || !file) return;

    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.set("format", format);
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
      <PageHeader title={t("title")} />

      <TopNav />

      <section className={styles.card}>
        <h2 className={styles.subtitle}>{t("formatLabel")}</h2>
        <select className={styles.select} value={format} onChange={(e) => setFormat(e.target.value)}>
          <option value="">{t("formatPlaceholder")}</option>
          {formats.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        {format && <p className={styles.hint}>{t("storeCountHint", { count: storeCountForFormat })}</p>}
        {formats.length === 0 && (
          <p className={styles.hint}>
            {t("noFormatsHint")} <Link href="/admin/stores" className={styles.inlineLink}>{t("noFormatsLink")}</Link>
          </p>
        )}
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

        <button className={styles.btnPrimary} type="submit" disabled={!format || !file || loading}>
          {loading ? t("submitting") : t("submit")}
        </button>
      </form>

      {result && (
        <section className={styles.card}>
          <h2 className={styles.subtitle}>{t("resultTitle", { format: result.format, count: result.storeCount })}</h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t("table.store")}</th>
                  <th>{t("table.node")}</th>
                  <th>{t("table.version")}</th>
                  <th>{t("table.items")}</th>
                  <th>{t("table.duplicates")}</th>
                </tr>
              </thead>
              <tbody>
                {result.results.map((r) => (
                  <tr key={`${r.store}-${r.node}`}>
                    <td>{r.store}</td>
                    <td>{r.node}</td>
                    <td>{r.version}</td>
                    <td>{r.itemCount}</td>
                    <td>{r.duplicates.length ? r.duplicates.join(", ") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}

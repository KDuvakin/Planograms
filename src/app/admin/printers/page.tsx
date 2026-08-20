"use client";

import { useRef, useState } from "react";
import useSWR from "swr";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/PageHeader";
import { TopNav } from "@/components/TopNav";
import styles from "@/components/admin/admin.module.css";
import { fetcher } from "@/lib/swrFetcher";
import { filterRows } from "@/lib/tableSearch";

interface Store {
  id: string;
  code: string;
}

interface Printer {
  id: string;
  name: string | null;
  ip: string;
  tray: string | null;
  store: { code: string };
}

interface MergedRow {
  id: string | null;
  storeCode: string;
  name: string;
  ip: string;
  tray: string;
}

interface StoreGroup {
  storeCode: string;
  rows: MergedRow[];
}

function mergeRows(stores: Store[] | undefined, printers: Printer[] | undefined): MergedRow[] {
  if (!stores) return [];
  const byStore = new Map<string, Printer[]>();
  for (const p of printers ?? []) {
    if (!byStore.has(p.store.code)) byStore.set(p.store.code, []);
    byStore.get(p.store.code)!.push(p);
  }
  const rows: MergedRow[] = [];
  for (const s of stores) {
    const ps = byStore.get(s.code);
    if (!ps || ps.length === 0) {
      rows.push({ id: null, storeCode: s.code, name: "", ip: "", tray: "" });
      continue;
    }
    for (const p of ps) {
      rows.push({ id: p.id, storeCode: s.code, name: p.name ?? "", ip: p.ip, tray: p.tray ?? "" });
    }
  }
  return rows;
}

/** A store can have several printers — flattening them into one long list makes a store
 * with many printers hard to tell apart from its neighbours, so they're grouped the same
 * collapsible-tree way the planogram catalog is. */
function groupByStore(rows: MergedRow[]): StoreGroup[] {
  const groups: StoreGroup[] = [];
  const byStore = new Map<string, MergedRow[]>();
  for (const r of rows) {
    if (!byStore.has(r.storeCode)) {
      byStore.set(r.storeCode, []);
      groups.push({ storeCode: r.storeCode, rows: byStore.get(r.storeCode)! });
    }
    byStore.get(r.storeCode)!.push(r);
  }
  return groups;
}

function PrinterRow({ row, onChanged }: { row: MergedRow; onChanged: () => void }) {
  const t = useTranslations("adminPrinters");
  const tCommon = useTranslations("common");
  const [name, setName] = useState(row.name);
  const [ip, setIp] = useState(row.ip);
  const [tray, setTray] = useState(row.tray);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!ip.trim()) {
      setError(t("errors.ipRequired"));
      return;
    }
    setSaving(true);
    setError(null);
    const res = row.id
      ? await fetch(`/api/printers/${row.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, ip, tray }),
        })
      : await fetch("/api/printers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storeCode: row.storeCode, name, ip, tray }),
        });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? t("errors.saveFailed"));
      return;
    }
    onChanged();
  }

  async function handleDelete() {
    if (!row.id) return;
    await fetch(`/api/printers/${row.id}`, { method: "DELETE" });
    onChanged();
  }

  return (
    <tr>
      <td>
        <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} />
      </td>
      <td>
        <input className={styles.input} value={ip} onChange={(e) => setIp(e.target.value)} />
      </td>
      <td>
        <input className={styles.input} value={tray} onChange={(e) => setTray(e.target.value)} />
      </td>
      <td>
        <div className={styles.rowActions}>
          <button type="button" className={styles.btnPrimary} onClick={handleSave} disabled={saving}>
            {saving ? t("saving") : t("save")}
          </button>
          {row.id && (
            <button type="button" className={styles.btnGhost} onClick={handleDelete}>
              {tCommon("delete")}
            </button>
          )}
        </div>
        {error && <p className={styles.error}>{error}</p>}
      </td>
    </tr>
  );
}

export default function PrintersAdminPage() {
  const t = useTranslations("adminPrinters");
  const { data: stores } = useSWR<Store[]>("/api/stores", fetcher);
  const { data: printers, mutate } = useSWR<Printer[]>("/api/printers", fetcher);
  const [query, setQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [storeCode, setStoreCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newIp, setNewIp] = useState("");
  const [newTray, setNewTray] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // Tree starts fully collapsed — a store only opens once the user taps it.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  function toggleStore(storeCode: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(storeCode)) next.delete(storeCode);
      else next.add(storeCode);
      return next;
    });
  }

  const rows = mergeRows(stores, printers);
  const filteredRows = filterRows(rows, query, (r) => [r.storeCode, r.name, r.ip, r.tray]);
  const groups = groupByStore(filteredRows);

  async function handleUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    setUploadResult(null);
    const formData = new FormData();
    formData.set("file", file);
    const res = await fetch("/api/printers/bulk-upload", { method: "POST", body: formData });
    const body = await res.json();
    setUploading(false);
    if (!res.ok) {
      setUploadError(body.error ?? t("errors.uploadFailed"));
      return;
    }
    let result = t("uploadResult", { stores: body.storesUpdated, printers: body.printersCreated });
    if (body.unknownStores?.length > 0) {
      result += " " + t("unknownStores", { codes: body.unknownStores.join(", ") });
    }
    setUploadResult(result);
    if (fileInputRef.current) fileInputRef.current.value = "";
    mutate();
  }

  async function handleAdd() {
    if (!storeCode.trim() || !newIp.trim()) return;
    setAdding(true);
    setAddError(null);
    const res = await fetch("/api/printers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeCode: storeCode.trim(), name: newName, ip: newIp, tray: newTray }),
    });
    const body = await res.json();
    setAdding(false);
    if (!res.ok) {
      setAddError(body.error ?? t("errors.addFailed"));
      return;
    }
    setStoreCode("");
    setNewName("");
    setNewIp("");
    setNewTray("");
    mutate();
  }

  return (
    <main className={styles.page}>
      <PageHeader title={t("title")} />

      <TopNav />

      <div className={styles.card}>
        <h2 className={styles.subtitle}>{t("uploadTitle")}</h2>
        <div className={styles.uploadRow}>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" />
          <button type="button" className={styles.btnPrimary} onClick={handleUpload} disabled={uploading}>
            {uploading ? t("uploading") : t("bulkUploadButton")}
          </button>
          {/* A file download, not a page to navigate to — next/link would try to prefetch/route it. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a className={styles.btnGhost} href="/api/printers/export">
            {t("downloadButton")}
          </a>
        </div>
        <p className={styles.hintText}>{t("uploadHint")}</p>
        {uploadResult && <p className={styles.hintText}>{uploadResult}</p>}
        {uploadError && <p className={styles.error}>{uploadError}</p>}
      </div>

      <div className={styles.card}>
        <h2 className={styles.subtitle}>{t("addTitle")}</h2>
        <div className={styles.form}>
          <label className={styles.field}>
            {t("table.store")}
            <input
              className={styles.input}
              placeholder={t("storeCodePlaceholder")}
              value={storeCode}
              onChange={(e) => setStoreCode(e.target.value)}
            />
          </label>
          <label className={styles.field}>
            {t("table.name")}
            <input className={styles.input} value={newName} onChange={(e) => setNewName(e.target.value)} />
          </label>
          <label className={styles.field}>
            {t("table.ip")}
            <input className={styles.input} value={newIp} onChange={(e) => setNewIp(e.target.value)} />
          </label>
          <label className={styles.field}>
            {t("table.tray")}
            <input className={styles.input} value={newTray} onChange={(e) => setNewTray(e.target.value)} />
          </label>
          <button className={styles.btnPrimary} type="button" onClick={handleAdd} disabled={adding}>
            {t("add")}
          </button>
          {addError && <p className={styles.error}>{addError}</p>}
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.searchRow}>
          <input
            className={styles.searchInput}
            type="search"
            placeholder={t("searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {stores && (
            <span className={styles.resultCount}>
              {filteredRows.length}/{rows.length}
            </span>
          )}
        </div>
        <div className={styles.catalogTree}>
          {groups.map((group) => {
            const isExpanded = expanded.has(group.storeCode);
            return (
              <div key={group.storeCode} className={styles.catalogGroup}>
                <button
                  type="button"
                  className={styles.catalogHeader}
                  onClick={() => toggleStore(group.storeCode)}
                  aria-expanded={isExpanded}
                >
                  <span className={styles.catalogHeaderLabel}>
                    {group.storeCode} <span className={styles.categoryCount}>({group.rows.length})</span>
                  </span>
                  <span className={`${styles.chevron} ${isExpanded ? "" : styles.chevronCollapsed}`}>▾</span>
                </button>

                {isExpanded && (
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>{t("table.name")}</th>
                          <th>{t("table.ip")}</th>
                          <th>{t("table.tray")}</th>
                          <th>{t("table.actions")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.rows.map((r) => (
                          <PrinterRow key={r.id ?? `new-${r.storeCode}`} row={r} onChanged={() => mutate()} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
          {groups.length === 0 && <p className={styles.hintText}>{t("empty")}</p>}
        </div>
      </div>
    </main>
  );
}

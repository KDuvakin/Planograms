"use client";

import { useState, type FormEvent } from "react";
import useSWR from "swr";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/PageHeader";
import { TopNav } from "@/components/TopNav";
import styles from "@/components/admin/admin.module.css";
import { fetcher } from "@/lib/swrFetcher";

interface Store {
  id: string;
  code: string;
  name: string | null;
  chain: string | null;
  format: string | null;
  address: string | null;
  email: string | null;
}

interface Printer {
  id: string;
  storeId: string;
  name: string | null;
  ip: string;
}


export default function StoresAdminPage() {
  const t = useTranslations("adminStores");
  const tCommon = useTranslations("common");
  const { data: stores, mutate } = useSWR<Store[]>("/api/stores", fetcher);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [chain, setChain] = useState("");
  const [format, setFormat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/stores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        name: name || undefined,
        chain: chain || undefined,
        format: format || undefined,
      }),
    });
    const body = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(body.error ?? t("errors.createStoreFailed"));
      return;
    }
    setCode("");
    setName("");
    setChain("");
    setFormat("");
    mutate();
  }

  async function updateStore(id: string, patch: Record<string, unknown>) {
    await fetch(`/api/stores/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    mutate();
  }

  async function handleDelete(id: string, label: string) {
    if (!window.confirm(t("confirmDelete", { store: label }))) return;
    setRowError(null);
    const res = await fetch(`/api/stores/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setRowError({ id, message: body?.error ?? t("errors.deleteStoreFailed") });
      return;
    }
    if (expanded === id) setExpanded(null);
    mutate();
  }

  return (
    <main className={styles.page}>
      <PageHeader title={t("title")} />

      <TopNav />

      <form className={styles.card} onSubmit={handleCreate}>
        <h2 className={styles.subtitle}>{t("newStoreTitle")}</h2>
        <div className={styles.form}>
          <label className={styles.field}>
            {t("code")}
            <input className={styles.input} value={code} onChange={(e) => setCode(e.target.value)} required />
          </label>
          <label className={styles.field}>
            {t("name")}
            <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className={styles.field}>
            {t("chain")}
            <input className={styles.input} value={chain} onChange={(e) => setChain(e.target.value)} />
          </label>
          <label className={styles.field}>
            {t("format")}
            <input className={styles.input} value={format} onChange={(e) => setFormat(e.target.value)} />
          </label>
          <button className={styles.btnPrimary} type="submit" disabled={loading}>
            {loading ? t("creating") : t("create")}
          </button>
          {error && <p className={styles.error}>{error}</p>}
        </div>
      </form>

      <div className={styles.card}>
        <h2 className={styles.subtitle}>{t("allStoresTitle")}</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t("table.code")}</th>
                <th>{t("table.name")}</th>
                <th>{t("table.chain")}</th>
                <th>{t("table.format")}</th>
                <th>{t("table.address")}</th>
                <th>{t("table.email")}</th>
                <th>{t("table.printers")}</th>
                <th>{t("table.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {stores?.map((s) => (
                <tr key={s.id}>
                  <td>
                    <input
                      className={styles.input}
                      defaultValue={s.code}
                      onBlur={(e) => {
                        if (e.target.value.trim() && e.target.value !== s.code) {
                          updateStore(s.id, { code: e.target.value });
                        }
                      }}
                    />
                  </td>
                  <td>
                    <input
                      className={styles.input}
                      defaultValue={s.name ?? ""}
                      onBlur={(e) => {
                        if (e.target.value !== (s.name ?? "")) updateStore(s.id, { name: e.target.value });
                      }}
                    />
                  </td>
                  <td>
                    <input
                      className={styles.input}
                      defaultValue={s.chain ?? ""}
                      onBlur={(e) => {
                        if (e.target.value !== (s.chain ?? "")) updateStore(s.id, { chain: e.target.value });
                      }}
                    />
                  </td>
                  <td>
                    <input
                      className={styles.input}
                      defaultValue={s.format ?? ""}
                      onBlur={(e) => {
                        if (e.target.value !== (s.format ?? "")) updateStore(s.id, { format: e.target.value });
                      }}
                    />
                  </td>
                  <td>
                    <input
                      className={styles.input}
                      defaultValue={s.address ?? ""}
                      onBlur={(e) => {
                        if (e.target.value !== (s.address ?? "")) updateStore(s.id, { address: e.target.value });
                      }}
                    />
                  </td>
                  <td>
                    <input
                      className={styles.input}
                      defaultValue={s.email ?? ""}
                      onBlur={(e) => {
                        if (e.target.value !== (s.email ?? "")) updateStore(s.id, { email: e.target.value });
                      }}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className={styles.btnPrimary}
                      onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                    >
                      {expanded === s.id ? t("hide") : t("configure")}
                    </button>
                  </td>
                  <td>
                    <button
                      type="button"
                      className={styles.btnGhost}
                      onClick={() => handleDelete(s.id, s.name ?? s.code)}
                    >
                      {tCommon("delete")}
                    </button>
                    {rowError?.id === s.id && <p className={styles.error}>{rowError.message}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {expanded && <PrintersPanel storeId={expanded} />}
    </main>
  );
}

function PrintersPanel({ storeId }: { storeId: string }) {
  const t = useTranslations("adminStores");
  const tCommon = useTranslations("common");
  const { data: printers, mutate } = useSWR<Printer[]>(`/api/stores/${storeId}/printers`, fetcher);
  const [name, setName] = useState("");
  const [ip, setIp] = useState("");

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!ip.trim()) return;
    await fetch(`/api/stores/${storeId}/printers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name || undefined, ip: ip.trim() }),
    });
    setName("");
    setIp("");
    mutate();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/printers/${id}`, { method: "DELETE" });
    mutate();
  }

  return (
    <div className={styles.card}>
      <h2 className={styles.subtitle}>{t("printersTitle")}</h2>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t("printerName")}</th>
              <th>{t("printerIp")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {printers?.map((p) => (
              <tr key={p.id}>
                <td>{p.name ?? "—"}</td>
                <td>{p.ip}</td>
                <td>
                  <button type="button" className={styles.btnGhost} onClick={() => handleDelete(p.id)}>
                    {tCommon("delete")}
                  </button>
                </td>
              </tr>
            ))}
            {printers?.length === 0 && (
              <tr>
                <td colSpan={3}>{t("noPrinters")}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <form className={styles.form} onSubmit={handleAdd}>
        <label className={styles.field}>
          {t("printerName")}
          <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className={styles.field}>
          {t("printerIp")}
          <input className={styles.input} value={ip} onChange={(e) => setIp(e.target.value)} required />
        </label>
        <button className={styles.btnPrimary} type="submit">
          {t("addPrinter")}
        </button>
      </form>
    </div>
  );
}

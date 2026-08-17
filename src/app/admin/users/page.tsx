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
}

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  role: "ADMIN" | "MANAGER" | "MERCHANDISER";
  active: boolean;
  store: { id: string; code: string } | null;
}

const ROLES = ["ADMIN", "MANAGER", "MERCHANDISER"] as const;

export default function UsersAdminPage() {
  const t = useTranslations("adminUsers");
  const { data: users, mutate } = useSWR<UserRow[]>("/api/users", fetcher);
  const { data: stores } = useSWR<Store[]>("/api/stores", fetcher);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]>("MERCHANDISER");
  const [storeId, setStoreId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name: name || undefined, role, storeId: storeId || undefined }),
    });
    const body = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(body.error ?? t("errors.createUserFailed"));
      return;
    }
    setEmail("");
    setPassword("");
    setName("");
    setRole("MERCHANDISER");
    setStoreId("");
    mutate();
  }

  async function updateUser(id: string, patch: Record<string, unknown>) {
    await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    mutate();
  }

  return (
    <main className={styles.page}>
      <PageHeader title={t("title")} />

      <TopNav />

      <form className={styles.card} onSubmit={handleCreate}>
        <h2 className={styles.subtitle}>{t("newUserTitle")}</h2>
        <div className={styles.form}>
          <label className={styles.field}>
            {t("email")}
            <input
              className={styles.input}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className={styles.field}>
            {t("password")}
            <input
              className={styles.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </label>
          <label className={styles.field}>
            {t("name")}
            <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className={styles.field}>
            {t("role")}
            <select
              className={styles.select}
              value={role}
              onChange={(e) => setRole(e.target.value as (typeof ROLES)[number])}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            {t("store")}
            <select className={styles.select} value={storeId} onChange={(e) => setStoreId(e.target.value)}>
              <option value="">—</option>
              {stores?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code}
                </option>
              ))}
            </select>
          </label>
          <button className={styles.btnPrimary} type="submit" disabled={loading}>
            {loading ? t("creating") : t("create")}
          </button>
          {error && <p className={styles.error}>{error}</p>}
        </div>
      </form>

      <div className={styles.card}>
        <h2 className={styles.subtitle}>{t("allUsersTitle")}</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t("table.email")}</th>
                <th>{t("table.name")}</th>
                <th>{t("table.role")}</th>
                <th>{t("table.store")}</th>
                <th>{t("table.active")}</th>
              </tr>
            </thead>
            <tbody>
              {users?.map((u) => (
                <tr key={u.id}>
                  <td>{u.email}</td>
                  <td>{u.name ?? "—"}</td>
                  <td>
                    <select
                      className={styles.select}
                      value={u.role}
                      onChange={(e) => updateUser(u.id, { role: e.target.value })}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      className={styles.select}
                      value={u.store?.id ?? ""}
                      onChange={(e) => updateUser(u.id, { storeId: e.target.value || null })}
                    >
                      <option value="">—</option>
                      {stores?.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.code}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={u.active}
                      onChange={(e) => updateUser(u.id, { active: e.target.checked })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

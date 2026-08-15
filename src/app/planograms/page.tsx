"use client";

import useSWR from "swr";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import styles from "./planograms.module.css";

interface PlanogramListItem {
  id: string;
  node: string;
  version: number;
  importedAt: string;
  itemCount: number;
  store: { id: string; code: string; name: string | null };
  runStatus: "NOT_STARTED" | "IN_PROGRESS" | "DONE" | "ABANDONED";
  currentRealStep: number;
  realStepsTotal: number;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function PlanogramsPage() {
  const t = useTranslations("planograms");
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
  const { data, isLoading } = useSWR<PlanogramListItem[]>("/api/planograms", fetcher);
  const { data: session } = useSession();
  const role = session?.user?.role;
  const isStaff = role === "ADMIN" || role === "MANAGER";

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t("title")}</h1>
        <div className={styles.headerActions}>
          <LanguageSwitcher />
          <button className={styles.signOut} onClick={() => signOut({ redirectTo: "/login" })}>
            {tNav("signOut")}
          </button>
        </div>
      </header>

      {isStaff && (
        <nav className={styles.staffNav}>
          <Link href="/admin/import">{tNav("import")}</Link>
          <Link href="/admin/users">{tNav("users")}</Link>
          <Link href="/admin/stores">{tNav("stores")}</Link>
          <Link href="/analytics">{tNav("analytics")}</Link>
        </nav>
      )}

      {isLoading && <p className={styles.hint}>{tCommon("loading")}</p>}
      {!isLoading && data?.length === 0 && <p className={styles.hint}>{t("empty")}</p>}

      <ul className={styles.list}>
        {data?.map((p) => {
          const statusLabel =
            p.runStatus === "IN_PROGRESS" || p.runStatus === "DONE" ? t(`status.${p.runStatus}`) : null;
          return (
            <li key={p.id}>
              <Link href={`/planograms/${p.id}`} className={styles.card}>
                <div className={styles.cardMain}>
                  <div className={styles.cardStore}>{p.store.code}</div>
                  <div className={styles.cardNode}>{p.node}</div>
                </div>
                <div className={styles.cardMeta}>
                  {t("meta", { itemCount: p.itemCount, version: p.version })}
                  {statusLabel && (
                    <span className={`${styles.statusBadge} ${styles[`status_${p.runStatus}`]}`}>
                      {statusLabel}
                      {p.runStatus === "IN_PROGRESS" ? ` ${p.currentRealStep}/${p.realStepsTotal}` : ""}
                    </span>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}

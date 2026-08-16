"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { TopNav } from "@/components/TopNav";
import styles from "./planograms.module.css";
import { fetcher } from "@/lib/swrFetcher";

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

interface StoreGroup {
  store: PlanogramListItem["store"];
  items: PlanogramListItem[];
}

function groupByStore(items: PlanogramListItem[]): StoreGroup[] {
  const map = new Map<string, StoreGroup>();
  for (const item of items) {
    const existing = map.get(item.store.id);
    if (existing) existing.items.push(item);
    else map.set(item.store.id, { store: item.store, items: [item] });
  }
  return Array.from(map.values());
}

export default function PlanogramsPage() {
  const t = useTranslations("planograms");
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
  const { data, isLoading } = useSWR<PlanogramListItem[]>("/api/planograms", fetcher);

  const groups = groupByStore(data ?? []);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  function toggleStore(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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

      <TopNav />

      {isLoading && <p className={styles.hint}>{tCommon("loading")}</p>}
      {!isLoading && data?.length === 0 && <p className={styles.hint}>{t("empty")}</p>}

      <div className={styles.tree}>
        {groups.map((group) => {
          const isCollapsed = collapsed.has(group.store.id);
          return (
            <section key={group.store.id} className={styles.storeGroup}>
              <button
                type="button"
                className={styles.storeHeader}
                onClick={() => toggleStore(group.store.id)}
                aria-expanded={!isCollapsed}
              >
                <span className={`${styles.chevron} ${isCollapsed ? styles.chevronCollapsed : ""}`}>▾</span>
                <span className={styles.storeCode}>{group.store.code}</span>
                {group.store.name && <span className={styles.storeName}>{group.store.name}</span>}
              </button>

              {!isCollapsed && (
                <ul className={styles.list}>
                  {group.items.map((p) => {
                    const dotClass =
                      p.runStatus === "DONE"
                        ? styles.dotGreen
                        : p.runStatus === "IN_PROGRESS"
                          ? styles.dotYellow
                          : styles.dotRed;
                    const statusLabel =
                      p.runStatus === "IN_PROGRESS" || p.runStatus === "DONE"
                        ? t(`status.${p.runStatus}`)
                        : null;
                    return (
                      <li key={p.id}>
                        <Link href={`/planograms/${p.id}`} className={styles.card}>
                          <span className={`${styles.statusDot} ${dotClass}`} />
                          <div className={styles.cardBody}>
                            <div className={styles.cardNode}>{p.node}</div>
                            <div className={styles.cardMeta}>
                              {t("meta", { itemCount: p.itemCount, version: p.version })}
                              {statusLabel && (
                                <span className={`${styles.statusBadge} ${styles[`status_${p.runStatus}`]}`}>
                                  {statusLabel}
                                  {p.runStatus === "IN_PROGRESS"
                                    ? ` ${p.currentRealStep}/${p.realStepsTotal}`
                                    : ""}
                                </span>
                              )}
                            </div>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}

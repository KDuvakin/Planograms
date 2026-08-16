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

interface Category {
  id: string;
  name: string;
  icon: string;
  nodePrefix: string | null;
  sortOrder: number;
}

interface CategoryGroup {
  key: string;
  name: string;
  icon: string;
  items: PlanogramListItem[];
}

function dotClassFor(item: PlanogramListItem, styles: Record<string, string>) {
  return item.runStatus === "DONE" ? styles.dotGreen : item.runStatus === "IN_PROGRESS" ? styles.dotYellow : styles.dotRed;
}

/** Worst status among a category's items — drives the small dot on its icon. Empty categories get none. */
function worstDotClass(items: PlanogramListItem[], styles: Record<string, string>): string | null {
  if (items.length === 0) return null;
  if (items.some((i) => i.runStatus === "NOT_STARTED" || i.runStatus === "ABANDONED")) return styles.dotRed;
  if (items.some((i) => i.runStatus === "IN_PROGRESS")) return styles.dotYellow;
  return styles.dotGreen;
}

function groupByCategory(items: PlanogramListItem[], categories: Category[], uncategorizedLabel: string): CategoryGroup[] {
  const groups: CategoryGroup[] = categories.map((c) => ({ key: c.id, name: c.name, icon: c.icon, items: [] }));
  const byPrefix = categories.filter((c) => c.nodePrefix);
  const leftover: PlanogramListItem[] = [];

  for (const item of items) {
    const match = byPrefix.find((c) => item.node.startsWith(c.nodePrefix!));
    if (match) groups.find((g) => g.key === match.id)!.items.push(item);
    else leftover.push(item);
  }

  if (leftover.length > 0) {
    groups.push({ key: "uncategorized", name: uncategorizedLabel, icon: "📦", items: leftover });
  }
  return groups;
}

export default function PlanogramsPage() {
  const t = useTranslations("planograms");
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
  const { data, isLoading } = useSWR<PlanogramListItem[]>("/api/planograms", fetcher);
  const { data: categories } = useSWR<Category[]>("/api/categories", fetcher);

  const groups = groupByCategory(data ?? [], categories ?? [], t("uncategorized"));
  const showStoreCode = new Set((data ?? []).map((p) => p.store.id)).size > 1;
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  function toggleCategory(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
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
          const isCollapsed = collapsed.has(group.key);
          const dotClass = worstDotClass(group.items, styles);
          return (
            <section key={group.key} className={styles.categoryGroup}>
              <button
                type="button"
                className={styles.categoryHeader}
                onClick={() => toggleCategory(group.key)}
                aria-expanded={!isCollapsed}
              >
                <span className={styles.categoryIconWrap}>
                  {dotClass && <span className={`${styles.categoryDot} ${dotClass}`} />}
                  {group.icon}
                </span>
                <span className={styles.categoryName}>
                  {group.name} <span className={styles.categoryCount}>({group.items.length})</span>
                </span>
                <span className={`${styles.chevron} ${isCollapsed ? styles.chevronCollapsed : ""}`}>▾</span>
              </button>

              {!isCollapsed && group.items.length > 0 && (
                <ul className={styles.list}>
                  {group.items.map((p) => {
                    const statusLabel =
                      p.runStatus === "IN_PROGRESS" || p.runStatus === "DONE"
                        ? t(`status.${p.runStatus}`)
                        : null;
                    return (
                      <li key={p.id}>
                        <Link href={`/planograms/${p.id}`} className={styles.card}>
                          <span className={`${styles.statusDot} ${dotClassFor(p, styles)}`} />
                          <div className={styles.cardBody}>
                            <div className={styles.cardNode}>
                              {showStoreCode && <span className={styles.rowStore}>{p.store.code} · </span>}
                              {p.node}
                            </div>
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

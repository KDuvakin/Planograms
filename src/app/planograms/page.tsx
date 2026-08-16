"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { TopNav } from "@/components/TopNav";
import { localizedName, type CategoryWithNodes } from "@/lib/nodeCategory";
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

interface SubGroup {
  name: string | null;
  items: PlanogramListItem[];
}

interface CategoryGroup {
  key: string;
  name: string;
  icon: string;
  items: PlanogramListItem[];
  subGroups: SubGroup[];
}

function dotClassFor(item: PlanogramListItem, styles: Record<string, string>) {
  return item.runStatus === "DONE" ? styles.dotGreen : item.runStatus === "IN_PROGRESS" ? styles.dotYellow : styles.dotRed;
}

/** Worst status among a category's items — drives the status dot in its header. Empty categories get none. */
function worstDotClass(items: PlanogramListItem[], styles: Record<string, string>): string | null {
  if (items.length === 0) return null;
  if (items.some((i) => i.runStatus === "NOT_STARTED" || i.runStatus === "ABANDONED")) return styles.dotRed;
  if (items.some((i) => i.runStatus === "IN_PROGRESS")) return styles.dotYellow;
  return styles.dotGreen;
}

/** Splits a category's items by their Node's given name (e.g. "Кофе") — items on a Node with no name stay flat. */
function subGroupsFor(category: CategoryWithNodes, items: PlanogramListItem[], locale: string): SubGroup[] {
  const nodeByCode = new Map(category.nodes.map((n) => [n.code, n]));
  const named = new Map<string, PlanogramListItem[]>();
  const flat: PlanogramListItem[] = [];
  for (const item of items) {
    const node = nodeByCode.get(item.node);
    if (!node) {
      flat.push(item);
      continue;
    }
    const name = localizedName(node, locale);
    if (!named.has(name)) named.set(name, []);
    named.get(name)!.push(item);
  }
  const result: SubGroup[] = Array.from(named.entries()).map(([name, groupItems]) => ({ name, items: groupItems }));
  if (flat.length > 0) result.push({ name: null, items: flat });
  return result;
}

function groupByCategory(
  items: PlanogramListItem[],
  categories: CategoryWithNodes[],
  locale: string,
  uncategorizedLabel: string
): CategoryGroup[] {
  const byId = new Map(categories.map((c) => [c.id, [] as PlanogramListItem[]]));
  const byPrefix = categories.filter((c) => c.nodePrefix);
  const leftover: PlanogramListItem[] = [];

  for (const item of items) {
    const exactOwner = categories.find((c) => c.nodes.some((n) => n.code === item.node));
    if (exactOwner) {
      byId.get(exactOwner.id)!.push(item);
      continue;
    }
    const prefixOwner = byPrefix.find((c) => item.node.startsWith(c.nodePrefix!));
    if (prefixOwner) byId.get(prefixOwner.id)!.push(item);
    else leftover.push(item);
  }

  const groups: CategoryGroup[] = categories.map((c) => {
    const categoryItems = byId.get(c.id)!;
    return {
      key: c.id,
      name: localizedName(c, locale),
      icon: c.icon,
      items: categoryItems,
      subGroups: subGroupsFor(c, categoryItems, locale),
    };
  });

  if (leftover.length > 0) {
    groups.push({
      key: "uncategorized",
      name: uncategorizedLabel,
      icon: "📦",
      items: leftover,
      subGroups: [{ name: null, items: leftover }],
    });
  }
  return groups;
}

export default function PlanogramsPage() {
  const t = useTranslations("planograms");
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const { data, isLoading } = useSWR<PlanogramListItem[]>("/api/planograms", fetcher);
  const { data: categories } = useSWR<CategoryWithNodes[]>("/api/categories", fetcher);

  const groups = groupByCategory(data ?? [], categories ?? [], locale, t("uncategorized"));
  const showStoreCode = new Set((data ?? []).map((p) => p.store.id)).size > 1;

  // Tree starts fully collapsed — a category only opens once the user taps it.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleCategory(key: string) {
    setExpanded((prev) => {
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
          const isExpanded = expanded.has(group.key);
          const dotClass = worstDotClass(group.items, styles);
          const newInGroup = group.items.filter((p) => p.runStatus === "NOT_STARTED").length;
          return (
            <section key={group.key} className={styles.categoryGroup}>
              <button
                type="button"
                className={styles.categoryHeader}
                onClick={() => toggleCategory(group.key)}
                aria-expanded={isExpanded}
              >
                <span className={styles.categoryIconWrap}>{group.icon}</span>
                <div className={styles.categoryNameCol}>
                  <span className={styles.categoryName}>
                    {group.name} <span className={styles.categoryCount}>({group.items.length})</span>
                  </span>
                  {group.items.length > 0 && (
                    <span className={styles.categoryNewCount}>
                      {t("newCount", { count: newInGroup, total: group.items.length })}
                    </span>
                  )}
                </div>
                {dotClass && <span className={`${styles.categoryStatusDot} ${dotClass}`} />}
                <span className={`${styles.chevron} ${isExpanded ? "" : styles.chevronCollapsed}`}>▾</span>
              </button>

              {isExpanded && group.items.length > 0 && (
                <>
                  {group.subGroups.map((sub) => (
                    <div key={sub.name ?? "flat"}>
                      {sub.name && <div className={styles.subGroupLabel}>{sub.name}</div>}
                      <ul className={styles.list}>
                        {sub.items.map((p) => {
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
                    </div>
                  ))}
                </>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}

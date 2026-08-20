"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { PageHeader } from "@/components/PageHeader";
import { TopNav } from "@/components/TopNav";
import { CatalogView } from "@/components/planograms/CatalogView";
import { localizedName, resolveNodeCategory, type CategoryWithNodes } from "@/lib/nodeCategory";
import styles from "./planograms.module.css";
import catalogStyles from "@/components/admin/admin.module.css";
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

const ONLY_NOT_DONE_KEY = "planograms.onlyNotDone";

export default function PlanogramsPage() {
  const { data: session } = useSession();
  const t = useTranslations("planograms");
  const role = session?.user?.role;

  // ADMIN/SPECIALIST get the wide, desktop-oriented catalog layout (admin.module.css);
  // STORE keeps the mobile-first operational tree — different enough page containers
  // (max-width, padding) that sharing one <main> would squeeze one of them.
  if (!role) return null;
  if (role !== "STORE") {
    return (
      <main className={catalogStyles.page}>
        <PageHeader title={t("title")} />
        <TopNav />
        <CatalogView />
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <PageHeader title={t("title")} />
      <TopNav />
      <StoreTree />
    </main>
  );
}

/** The operational, run-status-aware view a store user resets shelves from. */
function StoreTree() {
  const t = useTranslations("planograms");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const { data, isLoading } = useSWR<PlanogramListItem[]>("/api/planograms", fetcher);
  const { data: categories } = useSWR<CategoryWithNodes[]>("/api/categories", fetcher);

  // Persisted across visits — store users re-open this list constantly mid-shift and
  // shouldn't have to re-toggle the filter every time.
  const [onlyNotDone, setOnlyNotDone] = useState(
    () => typeof window !== "undefined" && localStorage.getItem(ONLY_NOT_DONE_KEY) === "1"
  );
  useEffect(() => {
    localStorage.setItem(ONLY_NOT_DONE_KEY, onlyNotDone ? "1" : "0");
  }, [onlyNotDone]);

  const filteredData = onlyNotDone ? (data ?? []).filter((p) => p.runStatus !== "DONE") : data;
  const groups = groupByCategory(filteredData ?? [], categories ?? [], locale, t("uncategorized"));
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
    <>
      {isLoading && <p className={styles.hint}>{tCommon("loading")}</p>}
      {!isLoading && data?.length === 0 && <p className={styles.hint}>{t("empty")}</p>}

      {!isLoading && data && data.length > 0 && (
        <label className={styles.filterRow}>
          <span className={styles.filterLabel}>{t("onlyNotDone")}</span>
          <span className={styles.switch}>
            <input
              type="checkbox"
              className={styles.switchInput}
              checked={onlyNotDone}
              onChange={(e) => setOnlyNotDone(e.target.checked)}
            />
            <span className={styles.switchTrack} />
          </span>
        </label>
      )}

      {onlyNotDone && filteredData?.length === 0 && data && data.length > 0 && (
        <p className={styles.hint}>{t("allDoneFiltered")}</p>
      )}

      <div className={styles.tree}>
        {groups.filter((group) => group.items.length > 0).map((group) => {
          const isExpanded = expanded.has(group.key);
          const dotClass = worstDotClass(group.items, styles);
          const newInGroup = group.items.filter((p) => p.runStatus === "NOT_STARTED").length;
          const inProgressInGroup = group.items.filter((p) => p.runStatus === "IN_PROGRESS").length;
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
                      {t("categoryStats", {
                        newCount: newInGroup,
                        inProgress: inProgressInGroup,
                        total: group.items.length,
                      })}
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
                          const nodeName = resolveNodeCategory(categories ?? [], p.node, locale)?.nodeName;
                          return (
                            <li key={p.id}>
                              <Link href={`/planograms/${p.id}`} className={styles.card}>
                                <span className={`${styles.statusDot} ${dotClassFor(p, styles)}`} />
                                <div className={styles.cardBody}>
                                  <div className={styles.cardNode}>
                                    {showStoreCode && <span className={styles.rowStore}>{p.store.code} · </span>}
                                    {p.node}
                                    {nodeName ? ` — ${nodeName}` : ""}
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
    </>
  );
}

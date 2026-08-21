"use client";

import { useState } from "react";
import useSWR from "swr";
import { useLocale, useTranslations } from "next-intl";
import { localizedName, type CategoryWithNodes } from "@/lib/nodeCategory";
import { filterRows } from "@/lib/tableSearch";
import styles from "@/components/admin/admin.module.css";
import treeStyles from "@/app/planograms/planograms.module.css";
import { fetcher } from "@/lib/swrFetcher";

interface CatalogEntry {
  format: string;
  node: string;
  lastUpdated: string;
  storeCount: number;
}

interface SubGroup {
  name: string | null;
  entries: (CatalogEntry & { nodeName: string | null })[];
}

interface CategoryGroup {
  key: string;
  name: string;
  icon: string;
  entries: (CatalogEntry & { nodeName: string | null })[];
  subGroups: SubGroup[];
}

/** Splits a category's entries by their Node's given name (e.g. "Кофе") — mirrors the
 * store tree's own subGroupsFor, so the same Node showing up under several formats still
 * lands in one named subgroup instead of one row per format. */
function subGroupsFor(entries: CategoryGroup["entries"]): SubGroup[] {
  const named = new Map<string, CategoryGroup["entries"]>();
  const flat: CategoryGroup["entries"] = [];
  for (const e of entries) {
    if (!e.nodeName) {
      flat.push(e);
      continue;
    }
    if (!named.has(e.nodeName)) named.set(e.nodeName, []);
    named.get(e.nodeName)!.push(e);
  }
  const result: SubGroup[] = Array.from(named.entries()).map(([name, groupEntries]) => ({
    name,
    entries: groupEntries,
  }));
  if (flat.length > 0) result.push({ name: null, entries: flat });
  return result;
}

/** Same category → planograms tree the store's own list uses (icon, name, count,
 * collapsible) — a Node can belong to only one category, so each catalog entry (one per
 * format × Node) lands in exactly one group. */
function groupByCategory(
  entries: CatalogEntry[],
  categories: CategoryWithNodes[],
  locale: string,
  uncategorizedLabel: string
): CategoryGroup[] {
  const byId = new Map(categories.map((c) => [c.id, [] as CategoryGroup["entries"]]));
  const byPrefix = categories.filter((c) => c.nodePrefix);
  const leftover: CategoryGroup["entries"] = [];

  for (const e of entries) {
    const exactOwner = categories.find((c) => c.nodes.some((n) => n.code === e.node));
    if (exactOwner) {
      const node = exactOwner.nodes.find((n) => n.code === e.node)!;
      byId.get(exactOwner.id)!.push({ ...e, nodeName: localizedName(node, locale) });
      continue;
    }
    const prefixOwner = byPrefix.find((c) => e.node.startsWith(c.nodePrefix!));
    if (prefixOwner) byId.get(prefixOwner.id)!.push({ ...e, nodeName: null });
    else leftover.push({ ...e, nodeName: null });
  }

  const groups: CategoryGroup[] = categories.map((c) => {
    const catEntries = byId.get(c.id)!;
    return {
      key: c.id,
      name: localizedName(c, locale),
      icon: c.icon,
      entries: catEntries,
      subGroups: subGroupsFor(catEntries),
    };
  });

  if (leftover.length > 0) {
    groups.push({
      key: "uncategorized",
      name: uncategorizedLabel,
      icon: "📦",
      entries: leftover,
      subGroups: [{ name: null, entries: leftover }],
    });
  }
  return groups;
}

/** ADMIN and SPECIALIST don't run resets — they need the catalog of unique planograms
 * (one per store format × Node) rather than the per-store operational tree, but grouped
 * and styled the same category → planograms way the store's own list is (just with a
 * store count in place of a run-status badge, since nothing here has a run to be "done"). */
export function CatalogView() {
  const t = useTranslations("planogramCatalog");
  const tPlanograms = useTranslations("planograms");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const { data, isLoading } = useSWR<CatalogEntry[]>("/api/planograms/catalog", fetcher);
  const { data: categories } = useSWR<CategoryWithNodes[]>("/api/categories", fetcher);
  const [query, setQuery] = useState("");
  const [formatQuery, setFormatQuery] = useState("");

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

  const nameFiltered = filterRows(data, query, (e) => {
    const exactOwner = (categories ?? []).find((c) => c.nodes.some((n) => n.code === e.node));
    const node = exactOwner?.nodes.find((n) => n.code === e.node);
    return [e.node, node ? localizedName(node, locale) : null];
  });
  const filtered = filterRows(nameFiltered, formatQuery, (e) => [e.format]);

  const groups = groupByCategory(filtered, categories ?? [], locale, tPlanograms("uncategorized")).filter(
    (g) => g.entries.length > 0
  );

  return (
    <div className={styles.card}>
      {isLoading && <p className={styles.hintText}>{tCommon("loading")}</p>}

      {data && (
        <>
          <div className={styles.statCards}>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{data.length}</div>
              <div className={styles.statLabel}>{t("totalLabel")}</div>
            </div>
          </div>

          <div className={styles.searchRow}>
            <input
              className={styles.searchInput}
              type="search"
              placeholder={t("searchPlaceholder")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <input
              className={styles.searchInput}
              type="search"
              placeholder={t("formatSearchPlaceholder")}
              value={formatQuery}
              onChange={(e) => setFormatQuery(e.target.value)}
            />
            <span className={styles.resultCount}>
              {filtered.length}/{data.length}
            </span>
          </div>

          <div className={treeStyles.tree}>
            {groups.map((group) => {
              const isExpanded = expanded.has(group.key);
              return (
                <section key={group.key} className={treeStyles.categoryGroup}>
                  <button
                    type="button"
                    className={treeStyles.categoryHeader}
                    onClick={() => toggleCategory(group.key)}
                    aria-expanded={isExpanded}
                  >
                    <span className={treeStyles.categoryIconWrap}>{group.icon}</span>
                    <div className={treeStyles.categoryNameCol}>
                      <span className={treeStyles.categoryName}>
                        {group.name} <span className={treeStyles.categoryCount}>({group.entries.length})</span>
                      </span>
                    </div>
                    <span className={`${treeStyles.chevron} ${isExpanded ? "" : treeStyles.chevronCollapsed}`}>▾</span>
                  </button>

                  {isExpanded && (
                    <>
                      {group.subGroups.map((sub) => (
                        <div key={sub.name ?? "flat"}>
                          {sub.name && <div className={treeStyles.subGroupLabel}>{sub.name}</div>}
                          <ul className={treeStyles.list}>
                            {sub.entries.map((e) => (
                              <li key={`${e.format}::${e.node}`}>
                                <div className={treeStyles.card}>
                                  <div className={treeStyles.cardBody}>
                                    <div className={treeStyles.cardNode}>
                                      {e.node}
                                      {e.nodeName ? ` — ${e.nodeName}` : ""}
                                    </div>
                                    <div className={treeStyles.cardMeta}>
                                      <span>
                                        {t("table.format")}: {e.format}
                                      </span>
                                      <span>
                                        {t("table.updated")}: {new Date(e.lastUpdated).toLocaleDateString(locale)}
                                      </span>
                                      <span className={`${treeStyles.statusBadge} ${treeStyles.infoBadge}`}>
                                        {e.storeCount} {t("table.stores")}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </>
                  )}
                </section>
              );
            })}
          </div>
          {groups.length === 0 && <p className={styles.hintText}>{t("empty")}</p>}
        </>
      )}
    </div>
  );
}

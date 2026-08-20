"use client";

import { useState } from "react";
import useSWR from "swr";
import { useLocale, useTranslations } from "next-intl";
import { localizedName, type CategoryWithNodes } from "@/lib/nodeCategory";
import { filterRows } from "@/lib/tableSearch";
import styles from "@/components/admin/admin.module.css";
import { fetcher } from "@/lib/swrFetcher";

interface CatalogEntry {
  format: string;
  node: string;
  lastUpdated: string;
  storeCount: number;
}

interface CategoryGroup {
  key: string;
  name: string;
  icon: string;
  entries: (CatalogEntry & { nodeName: string | null })[];
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

  const groups: CategoryGroup[] = categories.map((c) => ({
    key: c.id,
    name: localizedName(c, locale),
    icon: c.icon,
    entries: byId.get(c.id)!,
  }));

  if (leftover.length > 0) {
    groups.push({ key: "uncategorized", name: uncategorizedLabel, icon: "📦", entries: leftover });
  }
  return groups;
}

/** ADMIN and SPECIALIST don't run resets — they need the catalog of unique planograms
 * (one per store format × Node) rather than the per-store operational tree, but grouped
 * the same category → planograms way the store's own list is. */
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

          <div className={styles.catalogTree}>
            {groups.map((group) => {
              const isExpanded = expanded.has(group.key);
              return (
                <div key={group.key} className={styles.catalogGroup}>
                  <button
                    type="button"
                    className={styles.catalogHeader}
                    onClick={() => toggleCategory(group.key)}
                    aria-expanded={isExpanded}
                  >
                    <span className={styles.catalogIconWrap}>{group.icon}</span>
                    <span className={styles.catalogHeaderLabel}>
                      {group.name} <span className={styles.categoryCount}>({group.entries.length})</span>
                    </span>
                    <span className={`${styles.chevron} ${isExpanded ? "" : styles.chevronCollapsed}`}>▾</span>
                  </button>

                  {isExpanded && (
                    <div className={styles.tableWrap}>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>{t("table.node")}</th>
                            <th>{t("table.name")}</th>
                            <th>{t("table.format")}</th>
                            <th>{t("table.stores")}</th>
                            <th>{t("table.updated")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.entries.map((e) => (
                            <tr key={`${e.format}::${e.node}`}>
                              <td>{e.node}</td>
                              <td>{e.nodeName || "—"}</td>
                              <td>{e.format}</td>
                              <td>{e.storeCount}</td>
                              <td>{new Date(e.lastUpdated).toLocaleDateString(locale)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {groups.length === 0 && <p className={styles.hintText}>{t("empty")}</p>}
        </>
      )}
    </div>
  );
}

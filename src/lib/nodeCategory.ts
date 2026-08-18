export interface CategoryNode {
  code: string;
  name: string;
  nameEn: string | null;
  nameEt: string | null;
  nameLv: string | null;
}

export interface CategoryWithNodes {
  id: string;
  name: string;
  nameEn: string | null;
  nameEt: string | null;
  nameLv: string | null;
  icon: string;
  nodePrefix: string | null;
  sortOrder: number;
  nodes: CategoryNode[];
}

export interface ResolvedNodeCategory {
  categoryName: string;
  categoryIcon: string;
  nodeName: string | null;
}

/** Picks the name for the given locale, falling back to the Russian base name when no translation exists. */
export function localizedName(entity: { name: string; nameEn: string | null; nameEt: string | null; nameLv: string | null }, locale: string): string {
  if (locale === "en") return entity.nameEn ?? entity.name;
  if (locale === "et") return entity.nameEt ?? entity.name;
  if (locale === "lv") return entity.nameLv ?? entity.name;
  return entity.name;
}

/** Exact Node-code match wins (carries a name, e.g. "Кофе"); falls back to a category's nodePrefix bucket rule. */
export function resolveNodeCategory(categories: CategoryWithNodes[], node: string, locale: string): ResolvedNodeCategory | null {
  for (const category of categories) {
    // Some imports store the node value as "CODE - description" rather than the bare
    // code (e.g. "B47A - Supid, puljongid") — match on the leading code in that case too.
    const exact = category.nodes.find((n) => n.code === node || node.startsWith(`${n.code} `));
    if (exact) {
      return { categoryName: localizedName(category, locale), categoryIcon: category.icon, nodeName: localizedName(exact, locale) };
    }
  }
  const byPrefix = categories.find((c) => c.nodePrefix && node.startsWith(c.nodePrefix));
  if (byPrefix) return { categoryName: localizedName(byPrefix, locale), categoryIcon: byPrefix.icon, nodeName: null };
  return null;
}

export interface CategoryNode {
  code: string;
  name: string;
}

export interface CategoryWithNodes {
  id: string;
  name: string;
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

/** Exact Node-code match wins (carries a name, e.g. "Кофе"); falls back to a category's nodePrefix bucket rule. */
export function resolveNodeCategory(categories: CategoryWithNodes[], node: string): ResolvedNodeCategory | null {
  for (const category of categories) {
    const exact = category.nodes.find((n) => n.code === node);
    if (exact) return { categoryName: category.name, categoryIcon: category.icon, nodeName: exact.name };
  }
  const byPrefix = categories.find((c) => c.nodePrefix && node.startsWith(c.nodePrefix));
  if (byPrefix) return { categoryName: byPrefix.name, categoryIcon: byPrefix.icon, nodeName: null };
  return null;
}

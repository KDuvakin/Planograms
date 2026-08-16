/**
 * Product category (department → subcategory) per planogram Node.
 * No category data exists in the imported Excel — this is a fixed lookup the
 * business gave us directly for the currently known Node codes. Extend this
 * map as new Nodes are added; there is no admin UI for it yet.
 */
export interface NodeCategory {
  departmentKey: string;
  subcategoryKey: string;
  icon: string;
}

const NODE_CATEGORIES: Record<string, NodeCategory> = {
  B41: { departmentKey: "groceries", subcategoryKey: "coffee", icon: "☕" },
  B42A: { departmentKey: "groceries", subcategoryKey: "candy", icon: "🍬" },
  B43D: { departmentKey: "groceries", subcategoryKey: "cookies", icon: "🍪" },
  B44: { departmentKey: "groceries", subcategoryKey: "chips", icon: "🥔" },
  BA0: { departmentKey: "babyProducts", subcategoryKey: "babyFood", icon: "🍼" },
  B47A: { departmentKey: "groceries", subcategoryKey: "soups", icon: "🥣" },
};

export function categoryForNode(node: string): NodeCategory | null {
  return NODE_CATEGORIES[node] ?? null;
}

import { NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { handleApiError } from "@/lib/apiError";
import { prisma } from "@/lib/db";

// ADMIN and SPECIALIST don't run resets themselves — they need the catalog of unique
// planograms (one per store *format* × Node, since a format's stores all share the same
// layout) rather than the per-store operational list STORE sees.
export async function GET() {
  try {
    await requireRole("ADMIN", "SPECIALIST");

    const planograms = await prisma.planogram.findMany({
      where: { isCurrent: true },
      select: { node: true, importedAt: true, store: { select: { format: true } } },
    });

    const byKey = new Map<string, { format: string; node: string; lastUpdated: Date; storeCount: number }>();
    for (const p of planograms) {
      const format = p.store.format ?? "—";
      const key = `${format}::${p.node}`;
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, { format, node: p.node, lastUpdated: p.importedAt, storeCount: 1 });
      } else {
        existing.storeCount++;
        if (p.importedAt > existing.lastUpdated) existing.lastUpdated = p.importedAt;
      }
    }

    const catalog = Array.from(byKey.values()).sort(
      (a, b) => a.format.localeCompare(b.format) || a.node.localeCompare(b.node)
    );

    return NextResponse.json(catalog);
  } catch (e) {
    return handleApiError(e);
  }
}

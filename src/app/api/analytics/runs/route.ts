import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { handleApiError } from "@/lib/apiError";
import { prisma } from "@/lib/db";

const BUCKET_RANK: Record<string, number> = { DONE: 2, IN_PROGRESS: 1 };

export async function GET(req: NextRequest) {
  try {
    const session = await requireRole("ADMIN", "MANAGER");

    // MANAGER is confined to their own store — any ?storeId= override is ignored.
    const storeId =
      session.user.role === "ADMIN"
        ? (req.nextUrl.searchParams.get("storeId") ?? undefined)
        : (session.user.storeId ?? undefined);
    const userId = req.nextUrl.searchParams.get("userId") ?? undefined;
    const status = req.nextUrl.searchParams.get("status") ?? undefined;

    const allRuns = await prisma.planogramRun.findMany({
      where: {
        planogram: { isCurrent: true, ...(storeId ? { storeId } : {}) },
        ...(userId ? { userId } : {}),
      },
      orderBy: { lastActivityAt: "desc" },
      include: {
        user: { select: { email: true, name: true } },
        planogram: { select: { node: true, store: { select: { code: true } } } },
      },
    });

    // A planogram can have several runs (different users, abandoned retries) — collapse to
    // ONE row per planogram: DONE beats IN_PROGRESS beats everything else, and within that
    // bucket the most recently active run represents it (allRuns is already newest-first).
    const byPlanogram = new Map<string, (typeof allRuns)[number]>();
    for (const run of allRuns) {
      const existing = byPlanogram.get(run.planogramId);
      if (!existing) {
        byPlanogram.set(run.planogramId, run);
        continue;
      }
      if ((BUCKET_RANK[run.status] ?? 0) > (BUCKET_RANK[existing.status] ?? 0)) {
        byPlanogram.set(run.planogramId, run);
      }
    }

    let result = Array.from(byPlanogram.values());
    if (status) result = result.filter((r) => r.status === status);
    result.sort((a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime());

    return NextResponse.json(result.slice(0, 100));
  } catch (e) {
    return handleApiError(e);
  }
}

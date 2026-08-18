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
    result = result.slice(0, 100);

    // Feedback count is per *planogram*, summed across every run attempt on it — not just the
    // one representative run picked above — so it matches what the feedback drill-down shows.
    const feedbackCounts = await prisma.feedback.groupBy({
      by: ["runId"],
      _count: { _all: true },
      where: { runId: { in: allRuns.map((r) => r.id) } },
    });
    const countByRun = new Map(feedbackCounts.map((f) => [f.runId, f._count._all]));
    const countByPlanogram = new Map<string, number>();
    for (const run of allRuns) {
      countByPlanogram.set(run.planogramId, (countByPlanogram.get(run.planogramId) ?? 0) + (countByRun.get(run.id) ?? 0));
    }

    return NextResponse.json(
      result.map((r) => ({ ...r, feedbackCount: countByPlanogram.get(r.planogramId) ?? 0 }))
    );
  } catch (e) {
    return handleApiError(e);
  }
}

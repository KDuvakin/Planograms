import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { handleApiError } from "@/lib/apiError";
import { prisma } from "@/lib/db";

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
        // ABANDONED runs are explicitly superseded — never let a stale one represent a
        // planogram's row (matches /api/planograms and /api/analytics/summary).
        status: { not: "ABANDONED" },
        ...(userId ? { userId } : {}),
      },
      orderBy: { lastActivityAt: "desc" },
      include: {
        user: { select: { email: true, name: true } },
        planogram: { select: { node: true, store: { select: { code: true } } } },
      },
    });

    // A planogram can have several runs (different users, restarts) — collapse to ONE row
    // per planogram, represented by whichever run was touched most recently (allRuns is
    // already newest-first by lastActivityAt), not by "has anyone ever finished it" — a
    // restarted planogram must show as in-progress again, not stuck on an old completion.
    const byPlanogram = new Map<string, (typeof allRuns)[number]>();
    for (const run of allRuns) {
      if (!byPlanogram.has(run.planogramId)) byPlanogram.set(run.planogramId, run);
    }

    let result = Array.from(byPlanogram.values());
    if (status) result = result.filter((r) => r.status === status);
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

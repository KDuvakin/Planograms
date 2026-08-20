import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { handleApiError } from "@/lib/apiError";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const session = await requireRole("ADMIN", "SPECIALIST", "STORE");

    // A store user is confined to their own store — any ?storeId= override is ignored.
    // SPECIALIST sees every store, same as ADMIN.
    const storeId =
      session.user.role === "ADMIN" || session.user.role === "SPECIALIST"
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

    // Feedback count (and how many of those have a reply) is per *planogram*, summed across
    // every run attempt on it — not just the one representative run picked above — so it
    // matches what the feedback drill-down shows.
    const feedbackRows = await prisma.feedback.findMany({
      where: { runId: { in: allRuns.map((r) => r.id) } },
      select: { runId: true, reply: true, accepted: true },
    });
    const runToPlanogram = new Map(allRuns.map((r) => [r.id, r.planogramId]));
    const countByPlanogram = new Map<string, number>();
    const answeredByPlanogram = new Map<string, number>();
    for (const f of feedbackRows) {
      const planogramId = runToPlanogram.get(f.runId);
      if (!planogramId) continue;
      countByPlanogram.set(planogramId, (countByPlanogram.get(planogramId) ?? 0) + 1);
      // Ticking "accepted" is itself a reply — a specialist shouldn't have to type
      // something just to mark a piece of feedback as handled.
      if (f.reply?.trim() || f.accepted) {
        answeredByPlanogram.set(planogramId, (answeredByPlanogram.get(planogramId) ?? 0) + 1);
      }
    }

    return NextResponse.json(
      result.map((r) => {
        const feedbackCount = countByPlanogram.get(r.planogramId) ?? 0;
        const answeredCount = answeredByPlanogram.get(r.planogramId) ?? 0;
        return { ...r, feedbackCount, allFeedbackAnswered: feedbackCount > 0 && answeredCount === feedbackCount };
      })
    );
  } catch (e) {
    return handleApiError(e);
  }
}

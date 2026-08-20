import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/rbac";
import { handleApiError } from "@/lib/apiError";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const session = await requireUser();

    // STORE is confined to its own store — a store-scoped role, not just a default —
    // any ?storeId= override is ignored for it. ADMIN and SPECIALIST see (or filter
    // across) every store.
    const storeId =
      session.user.role === "ADMIN" || session.user.role === "SPECIALIST"
        ? (req.nextUrl.searchParams.get("storeId") ?? undefined)
        : (session.user.storeId ?? undefined);

    const planograms = await prisma.planogram.findMany({
      where: { isCurrent: true, ...(storeId ? { storeId } : {}) },
      orderBy: [{ storeId: "asc" }, { node: "asc" }],
      include: {
        store: { select: { id: true, code: true, name: true } },
        _count: { select: { items: true } },
      },
    });

    const runs = await prisma.planogramRun.findMany({
      where: {
        userId: session.user.id,
        planogramId: { in: planograms.map((p) => p.id) },
        // ABANDONED runs are explicitly superseded — never let a stale one represent status.
        status: { not: "ABANDONED" },
      },
      // Ordered by real engagement (lastActivityAt), not creation time: a user can complete a
      // planogram once (DONE) and later restart it, leaving an older DONE row with a *newer*
      // createdAt than the fresh IN_PROGRESS one it was created after — createdAt-ordering would
      // then show "done" here while the run screen (which only looks at active-status runs)
      // correctly offers to continue the unfinished restart. lastActivityAt reflects whichever
      // run the user actually touched most recently, so both views agree.
      orderBy: { lastActivityAt: "desc" },
      select: { planogramId: true, status: true, currentRealStep: true, realStepsTotal: true },
    });
    const runByPlanogram = new Map<string, (typeof runs)[number]>();
    for (const run of runs) {
      if (!runByPlanogram.has(run.planogramId)) runByPlanogram.set(run.planogramId, run);
    }

    return NextResponse.json(
      planograms.map((p) => {
        const run = runByPlanogram.get(p.id);
        return {
          id: p.id,
          node: p.node,
          version: p.version,
          importedAt: p.importedAt,
          store: p.store,
          itemCount: p._count.items,
          runStatus: run?.status ?? "NOT_STARTED",
          currentRealStep: run?.currentRealStep ?? 0,
          realStepsTotal: run?.realStepsTotal ?? 0,
        };
      })
    );
  } catch (e) {
    return handleApiError(e);
  }
}

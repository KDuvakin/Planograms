import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/rbac";
import { handleApiError } from "@/lib/apiError";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const session = await requireUser();

    // No explicit filter: a MERCHANDISER defaults to their own store's planograms.
    // Staff (ADMIN/MANAGER) see every store's planograms by default — they manage
    // multiple stores, not just the one their own account happens to be tied to.
    const storeId =
      req.nextUrl.searchParams.get("storeId") ??
      (session.user.role === "MERCHANDISER" ? session.user.storeId : undefined) ??
      undefined;

    const planograms = await prisma.planogram.findMany({
      where: { isCurrent: true, ...(storeId ? { storeId } : {}) },
      orderBy: [{ storeId: "asc" }, { node: "asc" }],
      include: {
        store: { select: { id: true, code: true, name: true } },
        _count: { select: { items: true } },
      },
    });

    const runs = await prisma.planogramRun.findMany({
      where: { userId: session.user.id, planogramId: { in: planograms.map((p) => p.id) } },
      orderBy: { createdAt: "desc" },
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

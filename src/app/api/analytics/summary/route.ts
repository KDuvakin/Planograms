import { NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { handleApiError } from "@/lib/apiError";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const session = await requireRole("ADMIN", "MANAGER");

    // MANAGER only ever sees their own store's numbers.
    const storeId = session.user.role === "MANAGER" ? session.user.storeId : undefined;
    const planogramFilter = storeId ? { planogram: { storeId } } : {};

    const planograms = await prisma.planogram.findMany({
      where: { isCurrent: true, ...(storeId ? { storeId } : {}) },
      select: { id: true },
    });
    const totalPlanograms = planograms.length;

    // A planogram can have several runs (one per user, plus abandoned retries) —
    // counting runs directly double-counts. Each planogram gets exactly one
    // bucket: DONE if anyone finished it, else IN_PROGRESS if anyone is on it,
    // else NOT_STARTED (covers zero runs and abandoned-only runs).
    const allRuns = await prisma.planogramRun.findMany({
      where: { planogram: { isCurrent: true, ...(storeId ? { storeId } : {}) } },
      select: { planogramId: true, status: true },
    });
    const bucketByPlanogram = new Map<string, "DONE" | "IN_PROGRESS" | "NOT_STARTED">();
    for (const r of allRuns) {
      const current = bucketByPlanogram.get(r.planogramId);
      if (current === "DONE") continue;
      if (r.status === "DONE") bucketByPlanogram.set(r.planogramId, "DONE");
      else if (r.status === "IN_PROGRESS" && current !== "IN_PROGRESS") {
        bucketByPlanogram.set(r.planogramId, "IN_PROGRESS");
      } else if (!current) {
        bucketByPlanogram.set(r.planogramId, "NOT_STARTED");
      }
    }

    let notStarted = 0;
    let inProgress = 0;
    let done = 0;
    for (const p of planograms) {
      const bucket = bucketByPlanogram.get(p.id) ?? "NOT_STARTED";
      if (bucket === "DONE") done++;
      else if (bucket === "IN_PROGRESS") inProgress++;
      else notStarted++;
    }
    const notDonePlanograms = totalPlanograms - done;

    const doneRuns = await prisma.planogramRun.findMany({
      where: { status: "DONE", startedAt: { not: null }, finishedAt: { not: null }, ...planogramFilter },
      select: {
        startedAt: true,
        finishedAt: true,
        planogram: { select: { store: { select: { code: true } } } },
        user: { select: { email: true, name: true } },
      },
      orderBy: { finishedAt: "desc" },
      take: 200,
    });

    const durationsMinutes = doneRuns.map(
      (r) => (r.finishedAt!.getTime() - r.startedAt!.getTime()) / 60000
    );
    const avgDurationMinutes = durationsMinutes.length
      ? Math.round((durationsMinutes.reduce((a, b) => a + b, 0) / durationsMinutes.length) * 10) / 10
      : null;

    const byStore = new Map<string, { storeCode: string; done: number; inProgress: number }>();
    const storeCounts = await prisma.planogramRun.findMany({
      where: { status: { in: ["DONE", "IN_PROGRESS"] }, ...planogramFilter },
      select: { status: true, planogram: { select: { store: { select: { code: true } } } } },
    });
    for (const r of storeCounts) {
      const code = r.planogram.store.code;
      if (!byStore.has(code)) byStore.set(code, { storeCode: code, done: 0, inProgress: 0 });
      const entry = byStore.get(code)!;
      if (r.status === "DONE") entry.done++;
      else entry.inProgress++;
    }

    const recentCompletions = doneRuns.slice(0, 10).map((r) => ({
      storeCode: r.planogram.store.code,
      userLabel: r.user.name ?? r.user.email,
      finishedAt: r.finishedAt,
      durationMinutes: Math.round(((r.finishedAt!.getTime() - r.startedAt!.getTime()) / 60000) * 10) / 10,
    }));

    return NextResponse.json({
      totals: { notStarted, inProgress, done, notDonePlanograms, totalPlanograms },
      avgDurationMinutes,
      byStore: Array.from(byStore.values()).sort((a, b) => a.storeCode.localeCompare(b.storeCode)),
      recentCompletions,
    });
  } catch (e) {
    return handleApiError(e);
  }
}

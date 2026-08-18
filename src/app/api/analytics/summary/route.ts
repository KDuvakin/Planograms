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
      select: { id: true, store: { select: { code: true } } },
    });
    const totalPlanograms = planograms.length;

    // A planogram can have several runs (one per user, plus restarts and abandoned
    // retries) — counting runs directly double-counts, and "DONE if anyone ever
    // finished it" goes stale the moment someone restarts: a planogram that was
    // completed and is now being redone would show as permanently "done". Each
    // planogram's bucket instead follows whichever non-abandoned run was touched
    // most recently — the same rule /api/planograms uses for the personal list, so
    // the two views can't contradict each other.
    const allRuns = await prisma.planogramRun.findMany({
      where: {
        planogram: { isCurrent: true, ...(storeId ? { storeId } : {}) },
        status: { not: "ABANDONED" },
      },
      select: { planogramId: true, status: true, lastActivityAt: true },
    });
    const latestByPlanogram = new Map<string, { status: string; lastActivityAt: Date }>();
    for (const r of allRuns) {
      const existing = latestByPlanogram.get(r.planogramId);
      if (!existing || r.lastActivityAt > existing.lastActivityAt) {
        latestByPlanogram.set(r.planogramId, { status: r.status, lastActivityAt: r.lastActivityAt });
      }
    }

    let notStarted = 0;
    let inProgress = 0;
    let done = 0;
    // Keyed by store code — same dedup as the overall totals just below, so "how many
    // planograms are done" can never disagree with "how many of THIS store's are done".
    const byStore = new Map<string, { storeCode: string; done: number; inProgress: number }>();
    for (const p of planograms) {
      const status = latestByPlanogram.get(p.id)?.status;
      if (status === "DONE") done++;
      else if (status === "IN_PROGRESS") inProgress++;
      else notStarted++;

      const code = p.store.code;
      if (!byStore.has(code)) byStore.set(code, { storeCode: code, done: 0, inProgress: 0 });
      const entry = byStore.get(code)!;
      if (status === "DONE") entry.done++;
      else if (status === "IN_PROGRESS") entry.inProgress++;
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

import { NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { handleApiError } from "@/lib/apiError";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    await requireRole("ADMIN", "MANAGER");

    const [notStarted, inProgress, done, abandoned] = await Promise.all([
      prisma.planogramRun.count({ where: { status: "NOT_STARTED" } }),
      prisma.planogramRun.count({ where: { status: "IN_PROGRESS" } }),
      prisma.planogramRun.count({ where: { status: "DONE" } }),
      prisma.planogramRun.count({ where: { status: "ABANDONED" } }),
    ]);

    const doneRuns = await prisma.planogramRun.findMany({
      where: { status: "DONE", startedAt: { not: null }, finishedAt: { not: null } },
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
      where: { status: { in: ["DONE", "IN_PROGRESS"] } },
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
      totals: { notStarted, inProgress, done, abandoned },
      avgDurationMinutes,
      byStore: Array.from(byStore.values()).sort((a, b) => a.storeCode.localeCompare(b.storeCode)),
      recentCompletions,
    });
  } catch (e) {
    return handleApiError(e);
  }
}

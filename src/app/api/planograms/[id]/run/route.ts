import { NextResponse } from "next/server";
import { requireUser } from "@/lib/rbac";
import { handleApiError } from "@/lib/apiError";
import { prisma } from "@/lib/db";

const ACTIVE_STATUSES = new Set(["NOT_STARTED", "IN_PROGRESS"]);

/** Get-or-create the caller's own active run for this planogram. */
export async function GET(_req: Request, ctx: RouteContext<"/api/planograms/[id]/run">) {
  try {
    const session = await requireUser();
    const { id: planogramId } = await ctx.params;

    // Look at the single most recent attempt (any status), not "the latest still-active
    // one" — an older IN_PROGRESS run must never resurface once a newer run (DONE or
    // ABANDONED) supersedes it, e.g. after a restart that didn't get around to marking
    // the old row ABANDONED.
    let run = await prisma.planogramRun.findFirst({
      where: { planogramId, userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });

    if (!run || !ACTIVE_STATUSES.has(run.status)) {
      run = await prisma.planogramRun.create({
        data: { planogramId, userId: session.user.id, status: "NOT_STARTED" },
      });
    }

    return NextResponse.json(run);
  } catch (e) {
    return handleApiError(e);
  }
}

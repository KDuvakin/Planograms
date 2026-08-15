import { NextResponse } from "next/server";
import { requireUser } from "@/lib/rbac";
import { handleApiError } from "@/lib/apiError";
import { prisma } from "@/lib/db";

const ACTIVE_STATUSES = ["NOT_STARTED", "IN_PROGRESS"] as const;

/** Get-or-create the caller's own active run for this planogram. */
export async function GET(_req: Request, ctx: RouteContext<"/api/planograms/[id]/run">) {
  try {
    const session = await requireUser();
    const { id: planogramId } = await ctx.params;

    let run = await prisma.planogramRun.findFirst({
      where: { planogramId, userId: session.user.id, status: { in: [...ACTIVE_STATUSES] } },
      orderBy: { createdAt: "desc" },
    });

    if (!run) {
      run = await prisma.planogramRun.create({
        data: { planogramId, userId: session.user.id, status: "NOT_STARTED" },
      });
    }

    return NextResponse.json(run);
  } catch (e) {
    return handleApiError(e);
  }
}

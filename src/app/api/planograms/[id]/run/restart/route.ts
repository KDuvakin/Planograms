import { NextResponse } from "next/server";
import { requireUser } from "@/lib/rbac";
import { handleApiError } from "@/lib/apiError";
import { prisma } from "@/lib/db";

/** Abandons the caller's current active run (if any) and starts a fresh one — history-preserving. */
export async function POST(_req: Request, ctx: RouteContext<"/api/planograms/[id]/run/restart">) {
  try {
    const session = await requireUser();
    const { id: planogramId } = await ctx.params;

    await prisma.planogramRun.updateMany({
      where: { planogramId, userId: session.user.id, status: { in: ["NOT_STARTED", "IN_PROGRESS"] } },
      data: { status: "ABANDONED" },
    });

    const run = await prisma.planogramRun.create({
      data: { planogramId, userId: session.user.id, status: "NOT_STARTED" },
    });

    return NextResponse.json(run);
  } catch (e) {
    return handleApiError(e);
  }
}

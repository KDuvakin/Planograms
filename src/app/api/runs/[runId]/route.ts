import { NextResponse } from "next/server";
import { requireUser, ForbiddenError } from "@/lib/rbac";
import { handleApiError } from "@/lib/apiError";
import { prisma } from "@/lib/db";

const VALID_STATUSES = new Set(["NOT_STARTED", "IN_PROGRESS", "DONE", "ABANDONED"]);

export async function PATCH(req: Request, ctx: RouteContext<"/api/runs/[runId]">) {
  try {
    const session = await requireUser();
    const { runId } = await ctx.params;
    const body = await req.json();

    const run = await prisma.planogramRun.findUnique({ where: { id: runId } });
    if (!run) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (run.userId !== session.user.id) {
      throw new ForbiddenError();
    }

    const data: {
      currentRealStep?: number;
      realStepsTotal?: number;
      status?: string;
      startedAt?: Date;
      finishedAt?: Date;
    } = {};

    if (typeof body.currentRealStep === "number") data.currentRealStep = body.currentRealStep;
    if (typeof body.realStepsTotal === "number") data.realStepsTotal = body.realStepsTotal;

    if (typeof body.status === "string" && VALID_STATUSES.has(body.status)) {
      data.status = body.status;
      if (body.status !== "NOT_STARTED" && !run.startedAt) {
        data.startedAt = new Date();
      }
      if (body.status === "DONE" && !run.finishedAt) {
        data.finishedAt = new Date();
      }
    }

    const updated = await prisma.planogramRun.update({ where: { id: runId }, data });
    return NextResponse.json(updated);
  } catch (e) {
    return handleApiError(e);
  }
}

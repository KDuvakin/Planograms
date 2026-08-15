import { NextResponse } from "next/server";
import { requireUser } from "@/lib/rbac";
import { handleApiError } from "@/lib/apiError";
import { prisma } from "@/lib/db";

export async function GET(_req: Request, ctx: RouteContext<"/api/planograms/[id]/items">) {
  try {
    await requireUser();
    const { id } = await ctx.params;

    const items = await prisma.planogramItem.findMany({
      where: { planogramId: id },
      orderBy: { sortIndex: "asc" },
    });

    return NextResponse.json(items);
  } catch (e) {
    return handleApiError(e);
  }
}

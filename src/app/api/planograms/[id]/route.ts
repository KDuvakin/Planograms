import { NextResponse } from "next/server";
import { requireUser } from "@/lib/rbac";
import { handleApiError } from "@/lib/apiError";
import { prisma } from "@/lib/db";

export async function GET(_req: Request, ctx: RouteContext<"/api/planograms/[id]">) {
  try {
    await requireUser();
    const { id } = await ctx.params;

    const planogram = await prisma.planogram.findUnique({
      where: { id },
      include: {
        store: { select: { id: true, code: true, name: true } },
        _count: { select: { items: true } },
      },
    });

    if (!planogram) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: planogram.id,
      node: planogram.node,
      version: planogram.version,
      isCurrent: planogram.isCurrent,
      shelfLengthCm: planogram.shelfLengthCm,
      sourceFileName: planogram.sourceFileName,
      importedAt: planogram.importedAt,
      store: planogram.store,
      itemCount: planogram._count.items,
    });
  } catch (e) {
    return handleApiError(e);
  }
}

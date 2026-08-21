import { NextResponse } from "next/server";
import { requireUser, requireRole, ForbiddenError } from "@/lib/rbac";
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
      mirrored: planogram.mirrored,
      sourceFileName: planogram.sourceFileName,
      importedAt: planogram.importedAt,
      store: planogram.store,
      itemCount: planogram._count.items,
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(req: Request, ctx: RouteContext<"/api/planograms/[id]">) {
  try {
    const session = await requireRole("ADMIN", "STORE");
    const { id } = await ctx.params;
    const body = await req.json();

    if (typeof body.mirrored !== "boolean") {
      return NextResponse.json({ error: "Нечего обновлять" }, { status: 400 });
    }

    if (session.user.role === "STORE") {
      const planogram = await prisma.planogram.findUnique({ where: { id }, select: { storeId: true } });
      if (!planogram) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      if (planogram.storeId !== session.user.storeId) {
        throw new ForbiddenError();
      }
    }

    const updated = await prisma.planogram.update({ where: { id }, data: { mirrored: body.mirrored } });
    return NextResponse.json({ id: updated.id, mirrored: updated.mirrored });
  } catch (e) {
    return handleApiError(e);
  }
}

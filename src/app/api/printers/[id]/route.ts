import { NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { handleApiError } from "@/lib/apiError";
import { prisma } from "@/lib/db";

export async function DELETE(_req: Request, ctx: RouteContext<"/api/printers/[id]">) {
  try {
    await requireRole("ADMIN");
    const { id } = await ctx.params;
    await prisma.printer.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}

import { NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { handleApiError } from "@/lib/apiError";
import { prisma } from "@/lib/db";

export async function PATCH(req: Request, ctx: RouteContext<"/api/printers/[id]">) {
  try {
    await requireRole("ADMIN");
    const { id } = await ctx.params;
    const body = await req.json();

    const data: { name?: string | null; ip?: string; tray?: string | null } = {};
    if (typeof body.name === "string") data.name = body.name.trim() || null;
    if (typeof body.ip === "string") {
      const ip = body.ip.trim();
      if (!ip) return NextResponse.json({ error: "IP обязателен" }, { status: 400 });
      data.ip = ip;
    }
    if (typeof body.tray === "string") data.tray = body.tray.trim() || null;

    const printer = await prisma.printer.update({
      where: { id },
      data,
      include: { store: { select: { code: true } } },
    });
    return NextResponse.json(printer);
  } catch (e) {
    return handleApiError(e);
  }
}

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

import { NextResponse } from "next/server";
import { requireRole, requireUser } from "@/lib/rbac";
import { handleApiError } from "@/lib/apiError";
import { prisma } from "@/lib/db";

export async function GET(_req: Request, ctx: RouteContext<"/api/stores/[id]/printers">) {
  try {
    await requireUser();
    const { id: storeId } = await ctx.params;
    const printers = await prisma.printer.findMany({ where: { storeId }, orderBy: { createdAt: "asc" } });
    return NextResponse.json(printers);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: Request, ctx: RouteContext<"/api/stores/[id]/printers">) {
  try {
    await requireRole("ADMIN");
    const { id: storeId } = await ctx.params;
    const body = await req.json();

    const ip = String(body.ip ?? "").trim();
    if (!ip) {
      return NextResponse.json({ error: "ip is required" }, { status: 400 });
    }

    const printer = await prisma.printer.create({
      data: { storeId, ip, name: body.name ? String(body.name) : undefined },
    });
    return NextResponse.json(printer, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}

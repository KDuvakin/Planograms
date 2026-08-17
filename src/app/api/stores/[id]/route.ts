import { NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { handleApiError } from "@/lib/apiError";
import { prisma } from "@/lib/db";

export async function PATCH(req: Request, ctx: RouteContext<"/api/stores/[id]">) {
  try {
    await requireRole("ADMIN");
    const { id } = await ctx.params;
    const body = await req.json();

    const data: {
      code?: string;
      name?: string | null;
      chain?: string | null;
      format?: string | null;
      address?: string | null;
      email?: string | null;
    } = {};
    if (typeof body.code === "string" && body.code.trim()) data.code = body.code.trim();
    if (typeof body.name === "string") data.name = body.name.trim() || null;
    if (typeof body.chain === "string") data.chain = body.chain.trim() || null;
    if (typeof body.format === "string") data.format = body.format.trim() || null;
    if (typeof body.address === "string") data.address = body.address.trim() || null;
    if (typeof body.email === "string") data.email = body.email.trim() || null;

    const store = await prisma.store.update({ where: { id }, data });
    return NextResponse.json(store);
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return NextResponse.json({ error: "Магазин с таким кодом уже существует" }, { status: 409 });
    }
    return handleApiError(e);
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/stores/[id]">) {
  try {
    await requireRole("ADMIN");
    const { id } = await ctx.params;
    await prisma.store.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && (e.code === "P2003" || e.code === "P2014")) {
      return NextResponse.json(
        { error: "Нельзя удалить магазин: с ним связаны пользователи или планограммы" },
        { status: 409 }
      );
    }
    return handleApiError(e);
  }
}

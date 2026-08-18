import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireRole } from "@/lib/rbac";
import { handleApiError } from "@/lib/apiError";
import { prisma } from "@/lib/db";

const VALID_ROLES = new Set(["ADMIN", "MANAGER", "MERCHANDISER"]);

export async function PATCH(req: Request, ctx: RouteContext<"/api/users/[id]">) {
  try {
    await requireRole("ADMIN");
    const { id } = await ctx.params;
    const body = await req.json();

    const data: {
      name?: string | null;
      role?: string;
      storeId?: string | null;
      active?: boolean;
      passwordHash?: string;
    } = {};

    if (typeof body.name === "string") data.name = body.name.trim() || null;
    if (typeof body.role === "string" && VALID_ROLES.has(body.role)) data.role = body.role;
    if ("storeId" in body) data.storeId = body.storeId ? String(body.storeId) : null;
    if (typeof body.active === "boolean") data.active = body.active;
    if (typeof body.password === "string" && body.password.length > 0) {
      if (body.password.length < 8) {
        return NextResponse.json({ error: "Пароль должен быть не короче 8 символов" }, { status: 400 });
      }
      data.passwordHash = await bcrypt.hash(body.password, 12);
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
    });

    return NextResponse.json(user);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/users/[id]">) {
  try {
    const session = await requireRole("ADMIN");
    const { id } = await ctx.params;
    if (id === session.user.id) {
      return NextResponse.json({ error: "Нельзя удалить свою же учётную запись" }, { status: 400 });
    }
    await prisma.user.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && (e.code === "P2003" || e.code === "P2014")) {
      return NextResponse.json(
        { error: "Нельзя удалить пользователя: с ним связаны импорты, прогоны или отзывы" },
        { status: 409 }
      );
    }
    return handleApiError(e);
  }
}

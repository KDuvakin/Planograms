import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireRole } from "@/lib/rbac";
import { handleApiError } from "@/lib/apiError";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    await requireRole("ADMIN");
    const users = await prisma.user.findMany({
      orderBy: { email: "asc" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        createdAt: true,
        store: { select: { id: true, code: true } },
      },
    });
    return NextResponse.json(users);
  } catch (e) {
    return handleApiError(e);
  }
}

const VALID_ROLES = new Set(["ADMIN", "MANAGER", "MERCHANDISER"]);

export async function POST(req: NextRequest) {
  try {
    await requireRole("ADMIN");
    const body = await req.json();

    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const name = body.name ? String(body.name).trim() : null;
    const role = VALID_ROLES.has(body.role) ? body.role : "MERCHANDISER";
    const storeId = body.storeId ? String(body.storeId) : null;

    if (!email || password.length < 8) {
      return NextResponse.json(
        { error: "email обязателен, пароль должен быть не короче 8 символов" },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, passwordHash, name, role, storeId },
      select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return NextResponse.json({ error: "Пользователь с таким email уже существует" }, { status: 409 });
    }
    return handleApiError(e);
  }
}

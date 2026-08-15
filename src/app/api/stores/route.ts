import { NextRequest, NextResponse } from "next/server";
import { requireRole, requireUser } from "@/lib/rbac";
import { handleApiError } from "@/lib/apiError";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    await requireUser();
    const stores = await prisma.store.findMany({ orderBy: { code: "asc" } });
    return NextResponse.json(stores);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireRole("ADMIN");
    const body = await req.json();
    const code = String(body.code ?? "").trim();
    if (!code) {
      return NextResponse.json({ error: "code is required" }, { status: 400 });
    }

    const store = await prisma.store.create({
      data: {
        code,
        name: body.name ? String(body.name) : undefined,
        chain: body.chain ? String(body.chain) : undefined,
        format: body.format ? String(body.format) : undefined,
        address: body.address ? String(body.address) : undefined,
        email: body.email ? String(body.email) : undefined,
      },
    });
    return NextResponse.json(store, { status: 201 });
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return NextResponse.json({ error: "Магазин с таким кодом уже существует" }, { status: 409 });
    }
    return handleApiError(e);
  }
}

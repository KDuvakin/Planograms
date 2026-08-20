import { NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { handleApiError } from "@/lib/apiError";
import { prisma } from "@/lib/db";

// Cross-store printer list — the dedicated admin Printers page, as opposed to
// /api/stores/[id]/printers which scopes to one store.
export async function GET() {
  try {
    await requireRole("ADMIN");
    const printers = await prisma.printer.findMany({
      include: { store: { select: { code: true } } },
      orderBy: [{ store: { code: "asc" } }, { createdAt: "asc" }],
    });
    return NextResponse.json(printers);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: Request) {
  try {
    await requireRole("ADMIN");
    const body = await req.json();

    const storeCode = String(body.storeCode ?? "").trim();
    const ip = String(body.ip ?? "").trim();
    if (!storeCode || !ip) {
      return NextResponse.json({ error: "Магазин и IP обязательны" }, { status: 400 });
    }

    const store = await prisma.store.findUnique({ where: { code: storeCode } });
    if (!store) {
      return NextResponse.json({ error: `Магазин «${storeCode}» не найден` }, { status: 404 });
    }

    const printer = await prisma.printer.create({
      data: {
        storeId: store.id,
        ip,
        name: body.name ? String(body.name).trim() || undefined : undefined,
        tray: body.tray ? String(body.tray).trim() || undefined : undefined,
      },
      include: { store: { select: { code: true } } },
    });
    return NextResponse.json(printer, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}

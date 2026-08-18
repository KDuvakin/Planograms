import { NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { handleApiError } from "@/lib/apiError";
import { prisma } from "@/lib/db";

interface PrinterInput {
  name?: string;
  ip: string;
}

export async function POST(req: Request, ctx: RouteContext<"/api/stores/[id]/printers/bulk">) {
  try {
    await requireRole("ADMIN");
    const { id: storeId } = await ctx.params;
    const body = await req.json();

    const printers = Array.isArray(body.printers) ? (body.printers as PrinterInput[]) : [];
    const valid = printers
      .map((p) => ({ ip: String(p.ip ?? "").trim(), name: p.name ? String(p.name).trim() : undefined }))
      .filter((p) => p.ip);

    if (valid.length === 0) {
      return NextResponse.json({ error: "Нет ни одного корректного IP" }, { status: 400 });
    }

    const result = await prisma.printer.createMany({
      data: valid.map((p) => ({ storeId, ip: p.ip, name: p.name })),
    });

    return NextResponse.json({ count: result.count }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}

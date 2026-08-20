import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireRole } from "@/lib/rbac";
import { handleApiError } from "@/lib/apiError";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireRole("ADMIN");
    const printers = await prisma.printer.findMany({
      include: { store: { select: { code: true } } },
      orderBy: [{ store: { code: "asc" } }, { createdAt: "asc" }],
    });

    const rows = printers.map((p) => ({
      store_number: p.store.code,
      name: p.name ?? "",
      printer_ip: p.ip,
      tray: p.tray ?? "",
    }));

    const sheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Printers");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="printers.xlsx"',
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}

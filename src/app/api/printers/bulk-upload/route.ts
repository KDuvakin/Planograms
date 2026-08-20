import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireRole } from "@/lib/rbac";
import { handleApiError } from "@/lib/apiError";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

interface ParsedRow {
  storeCode: string;
  name?: string;
  ip: string;
  tray?: string;
}

function parseRows(buffer: Buffer): ParsedRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  return raw
    .map((r) => {
      const clean: Record<string, string> = {};
      for (const k of Object.keys(r)) {
        clean[k.trim().toLowerCase()] = String(r[k] ?? "").trim();
      }
      return {
        storeCode: clean["store_number"] ?? "",
        name: clean["name"] || undefined,
        ip: clean["printer_ip"] ?? "",
        tray: clean["tray"] || undefined,
      };
    })
    .filter((r) => r.storeCode && r.ip);
}

// Replaces every printer for any store mentioned in the file — stores not listed are
// left completely untouched, so this is safe to re-run with a partial list.
export async function POST(req: NextRequest) {
  try {
    await requireRole("ADMIN");
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Файл обязателен" }, { status: 400 });
    }

    const rows = parseRows(Buffer.from(await file.arrayBuffer()));
    if (rows.length === 0) {
      return NextResponse.json({ error: "Не найдено ни одной строки с store_number и printer_ip" }, { status: 400 });
    }

    const byStore = new Map<string, ParsedRow[]>();
    for (const r of rows) {
      if (!byStore.has(r.storeCode)) byStore.set(r.storeCode, []);
      byStore.get(r.storeCode)!.push(r);
    }

    const stores = await prisma.store.findMany({
      where: { code: { in: Array.from(byStore.keys()) } },
      select: { id: true, code: true },
    });
    const storeByCode = new Map(stores.map((s) => [s.code, s.id]));
    const unknownStores = Array.from(byStore.keys()).filter((code) => !storeByCode.has(code));

    let storesUpdated = 0;
    let printersCreated = 0;
    for (const [code, storeRows] of byStore) {
      const storeId = storeByCode.get(code);
      if (!storeId) continue;
      await prisma.$transaction([
        prisma.printer.deleteMany({ where: { storeId } }),
        prisma.printer.createMany({
          data: storeRows.map((r) => ({ storeId, ip: r.ip, name: r.name, tray: r.tray })),
        }),
      ]);
      storesUpdated++;
      printersCreated += storeRows.length;
    }

    return NextResponse.json({ storesUpdated, printersCreated, unknownStores });
  } catch (e) {
    return handleApiError(e);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { handleApiError } from "@/lib/apiError";
import { prisma } from "@/lib/db";
import { parseWorkbookRows } from "@/lib/import/parseWorkbook";
import { groupRowsByNode, stitchNodeRows } from "@/lib/engine";

export const runtime = "nodejs";

interface NodeImportSummary {
  store: string;
  node: string;
  version: number;
  itemCount: number;
  duplicates: string[];
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireRole("ADMIN");

    const formData = await req.formData();
    const format = String(formData.get("format") ?? "");
    const file = formData.get("file");

    if (!format) {
      return NextResponse.json({ error: "format is required" }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    const stores = await prisma.store.findMany({ where: { format }, orderBy: { code: "asc" } });
    if (stores.length === 0) {
      return NextResponse.json({ error: "Нет магазинов с таким форматом" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const rows = parseWorkbookRows(buffer);
    const byNode = groupRowsByNode(rows);

    if (byNode.size === 0) {
      return NextResponse.json(
        { error: "В файле не найдено ни одной строки со значением Node" },
        { status: 400 }
      );
    }

    // Same file, same stitched items — applied once per store sharing this format, so
    // every store gets its own Planogram/PlanogramRun history instead of one shared copy.
    const stitchedByNode = new Map(
      Array.from(byNode.entries()).map(([node, nodeRows]) => [node, stitchNodeRows(nodeRows)] as const)
    );

    const results: NodeImportSummary[] = [];

    for (const store of stores) {
      for (const [node, { items, duplicates }] of stitchedByNode) {
        const summary = await prisma.$transaction(async (tx) => {
          const previous = await tx.planogram.findFirst({
            where: { storeId: store.id, node, isCurrent: true },
          });

          if (previous) {
            await tx.planogram.update({ where: { id: previous.id }, data: { isCurrent: false } });
          }

          const planogram = await tx.planogram.create({
            data: {
              storeId: store.id,
              node,
              version: (previous?.version ?? 0) + 1,
              isCurrent: true,
              // Carried forward from the previous version — re-importing a Node shouldn't
              // silently reset a store's mirror setting for it back to the default.
              mirrored: previous?.mirrored ?? false,
              sourceFileName: file.name,
              importedById: session.user.id,
            },
          });

          if (items.length > 0) {
            await tx.planogramItem.createMany({
              data: items.map((item, index) => ({
                planogramId: planogram.id,
                sortIndex: index,
                ...item,
              })),
            });
          }

          return { store: store.code, node, version: planogram.version, itemCount: items.length, duplicates };
        });

        results.push(summary);
      }
    }

    return NextResponse.json({ format, storeCount: stores.length, results });
  } catch (e) {
    return handleApiError(e);
  }
}

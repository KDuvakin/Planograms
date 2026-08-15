import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { handleApiError } from "@/lib/apiError";
import { prisma } from "@/lib/db";
import { parseWorkbookRows } from "@/lib/import/parseWorkbook";
import { groupRowsByNode, stitchNodeRows } from "@/lib/engine";

export const runtime = "nodejs";

interface NodeImportSummary {
  node: string;
  version: number;
  itemCount: number;
  duplicates: string[];
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireRole("ADMIN");

    const formData = await req.formData();
    const storeId = String(formData.get("storeId") ?? "");
    const file = formData.get("file");

    if (!storeId) {
      return NextResponse.json({ error: "storeId is required" }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    const store = await prisma.store.findUnique({ where: { id: storeId } });
    if (!store) {
      return NextResponse.json({ error: "Unknown store" }, { status: 400 });
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

    const results: NodeImportSummary[] = [];

    for (const [node, nodeRows] of byNode) {
      const { items, duplicates } = stitchNodeRows(nodeRows);

      const summary = await prisma.$transaction(async (tx) => {
        const previous = await tx.planogram.findFirst({
          where: { storeId, node, isCurrent: true },
        });

        if (previous) {
          await tx.planogram.update({ where: { id: previous.id }, data: { isCurrent: false } });
        }

        const planogram = await tx.planogram.create({
          data: {
            storeId,
            node,
            version: (previous?.version ?? 0) + 1,
            isCurrent: true,
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

        return { node, version: planogram.version, itemCount: items.length, duplicates };
      });

      results.push(summary);
    }

    return NextResponse.json({ store: store.code, results });
  } catch (e) {
    return handleApiError(e);
  }
}

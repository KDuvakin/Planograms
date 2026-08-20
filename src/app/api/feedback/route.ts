import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { requireRole, requireUser } from "@/lib/rbac";
import { handleApiError } from "@/lib/apiError";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const MAX_SIZE = 8 * 1024 * 1024; // 8 MB
const MAX_PHOTOS = 3;

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "feedback");

export async function GET() {
  try {
    const session = await requireRole("ADMIN", "SPECIALIST", "STORE");

    // A store user only ever sees their own store's feedback — everyone else (ADMIN,
    // SPECIALIST) sees it all, same as the existing analytics access pattern.
    const isStore = session.user.role === "STORE";

    const feedback = await prisma.feedback.findMany({
      where: isStore ? { run: { planogram: { storeId: session.user.storeId ?? "__none__" } } } : {},
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        user: { select: { email: true, name: true } },
        repliedBy: { select: { email: true, name: true } },
        planogramItem: { select: { sap: true, article: true } },
        photos: { select: { url: true } },
        run: {
          select: {
            planogramId: true,
            planogram: { select: { node: true, store: { select: { code: true } } } },
          },
        },
      },
    });

    return NextResponse.json(feedback);
  } catch (e) {
    return handleApiError(e);
  }
}

function bool(formData: FormData, key: string): boolean {
  return formData.get(key) === "true" || formData.get(key) === "on";
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireUser();
    const formData = await req.formData();

    const runId = String(formData.get("runId") ?? "");
    const comment = String(formData.get("comment") ?? "").trim();
    const stepRealIndex = Number(formData.get("stepRealIndex") ?? 0);
    const planogramItemIdRaw = formData.get("planogramItemId");
    const planogramItemId = planogramItemIdRaw ? String(planogramItemIdRaw) : null;

    const isShelfReadyRaw = formData.get("isShelfReady");
    const isShelfReady = isShelfReadyRaw == null ? null : bool(formData, "isShelfReady");
    const needSeparator = bool(formData, "needSeparator");
    const doesntFitByHeight = bool(formData, "doesntFitByHeight");
    const doesntFitFacesQty = bool(formData, "doesntFitFacesQty");
    const otherReason = bool(formData, "otherReason");

    const photos = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);

    if (!runId) {
      return NextResponse.json({ error: "runId обязателен" }, { status: 400 });
    }
    const hasAnyReason = needSeparator || doesntFitByHeight || doesntFitFacesQty || otherReason;
    if (!comment && !hasAnyReason) {
      return NextResponse.json(
        { error: "Отметьте причину или добавьте комментарий" },
        { status: 400 }
      );
    }
    if (photos.length > MAX_PHOTOS) {
      return NextResponse.json({ error: `Можно приложить не более ${MAX_PHOTOS} фото` }, { status: 400 });
    }

    // ownership check — a user may only attach feedback to their own run
    const run = await prisma.planogramRun.findUnique({ where: { id: runId } });
    if (!run || run.userId !== session.user.id) {
      return NextResponse.json({ error: "Unknown run" }, { status: 400 });
    }

    const photoUrls: string[] = [];
    if (photos.length > 0) await mkdir(UPLOAD_DIR, { recursive: true });
    for (const photo of photos) {
      const ext = ALLOWED_TYPES[photo.type];
      if (!ext) {
        return NextResponse.json({ error: "Неподдерживаемый формат фото" }, { status: 400 });
      }
      if (photo.size > MAX_SIZE) {
        return NextResponse.json({ error: "Файл слишком большой (максимум 8 МБ)" }, { status: 400 });
      }

      const filename = `${randomUUID()}.${ext}`;
      const buffer = Buffer.from(await photo.arrayBuffer());
      await writeFile(path.join(UPLOAD_DIR, filename), buffer);
      photoUrls.push(`/uploads/feedback/${filename}`);
    }

    const feedback = await prisma.feedback.create({
      data: {
        runId,
        planogramItemId,
        stepRealIndex,
        comment,
        isShelfReady,
        needSeparator,
        doesntFitByHeight,
        doesntFitFacesQty,
        otherReason,
        userId: session.user.id,
        photos: { create: photoUrls.map((url) => ({ url })) },
      },
      include: { photos: true },
    });

    return NextResponse.json(feedback, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}

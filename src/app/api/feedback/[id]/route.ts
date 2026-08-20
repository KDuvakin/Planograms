import { NextResponse } from "next/server";
import { requireUser, ForbiddenError } from "@/lib/rbac";
import { handleApiError } from "@/lib/apiError";
import { prisma } from "@/lib/db";

export async function PATCH(req: Request, ctx: RouteContext<"/api/feedback/[id]">) {
  try {
    const session = await requireUser();
    const { id } = await ctx.params;
    const body = await req.json();
    const role = session.user.role;

    const data: {
      reply?: string;
      repliedById?: string;
      repliedAt?: Date;
      accepted?: boolean;
      flaggedByStore?: boolean;
    } = {};

    if (role === "ADMIN" || role === "SPECIALIST") {
      // A specialist's reply and their "acknowledged" checkbox — written together so a
      // reply always carries who wrote it and when.
      if (typeof body.reply === "string") {
        data.reply = body.reply.trim();
        data.repliedById = session.user.id;
        data.repliedAt = new Date();
      }
      if (typeof body.accepted === "boolean") data.accepted = body.accepted;
    } else if (role === "STORE") {
      // The store may only flag feedback that belongs to its own runs.
      if (typeof body.flaggedByStore === "boolean") {
        const feedback = await prisma.feedback.findUnique({
          where: { id },
          select: { run: { select: { planogram: { select: { storeId: true } } } } },
        });
        if (!feedback) {
          return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
        if (feedback.run.planogram.storeId !== session.user.storeId) {
          throw new ForbiddenError();
        }
        data.flaggedByStore = body.flaggedByStore;
      }
    } else {
      throw new ForbiddenError();
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Нечего обновлять" }, { status: 400 });
    }

    const updated = await prisma.feedback.update({
      where: { id },
      data,
      include: {
        user: { select: { email: true, name: true } },
        repliedBy: { select: { email: true, name: true } },
        planogramItem: { select: { sap: true, article: true } },
        photos: { select: { url: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (e) {
    return handleApiError(e);
  }
}

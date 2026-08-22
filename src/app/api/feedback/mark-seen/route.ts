import { NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { handleApiError } from "@/lib/apiError";
import { prisma } from "@/lib/db";

// Called once the store actually opens its feedback list — flips seenByStore on every
// answered entry so the badge/banner clear instead of re-notifying for the same reply.
export async function POST() {
  try {
    const session = await requireRole("STORE");
    const candidates = await prisma.feedback.findMany({
      where: {
        run: { planogram: { storeId: session.user.storeId ?? "__none__" } },
        seenByStore: false,
      },
      select: { id: true, reply: true, accepted: true, flaggedBySpecialist: true },
    });
    const ids = candidates.filter((f) => f.reply?.trim() || f.accepted || f.flaggedBySpecialist).map((f) => f.id);
    if (ids.length > 0) {
      await prisma.feedback.updateMany({ where: { id: { in: ids } }, data: { seenByStore: true } });
    }
    return NextResponse.json({ updated: ids.length });
  } catch (e) {
    return handleApiError(e);
  }
}

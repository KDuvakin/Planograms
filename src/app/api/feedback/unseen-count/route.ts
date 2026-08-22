import { NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { handleApiError } from "@/lib/apiError";
import { prisma } from "@/lib/db";

// How many of the store's own feedback entries have a specialist reply/acknowledgement/
// clarification request the store hasn't looked at yet — drives the nav badge and the
// planograms-page banner.
export async function GET() {
  try {
    const session = await requireRole("STORE");
    const candidates = await prisma.feedback.findMany({
      where: {
        run: { planogram: { storeId: session.user.storeId ?? "__none__" } },
        seenByStore: false,
      },
      select: { reply: true, accepted: true, flaggedBySpecialist: true },
    });
    // "answered" mirrors the analytics table's rule: an acknowledgement alone counts,
    // even with no reply text — but a stray empty-string reply with no ack doesn't.
    // A specialist's "please check/clarify" flag is just as notification-worthy.
    const count = candidates.filter((f) => f.reply?.trim() || f.accepted || f.flaggedBySpecialist).length;
    return NextResponse.json({ count });
  } catch (e) {
    return handleApiError(e);
  }
}

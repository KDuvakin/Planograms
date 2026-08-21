import { NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { handleApiError } from "@/lib/apiError";
import { prisma } from "@/lib/db";

// How many of the store's own feedback entries have a specialist reply/acknowledgement
// the store hasn't looked at yet — drives the nav badge and the planograms-page banner.
export async function GET() {
  try {
    const session = await requireRole("STORE");
    const candidates = await prisma.feedback.findMany({
      where: {
        run: { planogram: { storeId: session.user.storeId ?? "__none__" } },
        seenByStore: false,
      },
      select: { reply: true, accepted: true },
    });
    // "answered" mirrors the analytics table's rule: an acknowledgement alone counts,
    // even with no reply text — but a stray empty-string reply with no ack doesn't.
    const count = candidates.filter((f) => f.reply?.trim() || f.accepted).length;
    return NextResponse.json({ count });
  } catch (e) {
    return handleApiError(e);
  }
}

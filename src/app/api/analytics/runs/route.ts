import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { handleApiError } from "@/lib/apiError";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const session = await requireRole("ADMIN", "MANAGER");

    // MANAGER is confined to their own store — any ?storeId= override is ignored.
    const storeId =
      session.user.role === "ADMIN"
        ? (req.nextUrl.searchParams.get("storeId") ?? undefined)
        : (session.user.storeId ?? undefined);
    const userId = req.nextUrl.searchParams.get("userId") ?? undefined;
    const status = req.nextUrl.searchParams.get("status") ?? undefined;

    const runs = await prisma.planogramRun.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(userId ? { userId } : {}),
        ...(storeId ? { planogram: { storeId } } : {}),
      },
      orderBy: { lastActivityAt: "desc" },
      take: 100,
      include: {
        user: { select: { email: true, name: true } },
        planogram: { select: { node: true, store: { select: { code: true } } } },
      },
    });

    return NextResponse.json(runs);
  } catch (e) {
    return handleApiError(e);
  }
}

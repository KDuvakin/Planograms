import { NextResponse } from "next/server";
import { requireUser } from "@/lib/rbac";
import { handleApiError } from "@/lib/apiError";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    await requireUser();

    const categories = await prisma.category.findMany({ orderBy: { sortOrder: "asc" } });

    return NextResponse.json(categories);
  } catch (e) {
    return handleApiError(e);
  }
}

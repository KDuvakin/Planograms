import { NextResponse } from "next/server";
import { ForbiddenError, UnauthorizedError } from "@/lib/rbac";

export function handleApiError(e: unknown) {
  if (e instanceof UnauthorizedError) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (e instanceof ForbiddenError) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  console.error(e);
  return NextResponse.json({ error: "Internal error" }, { status: 500 });
}

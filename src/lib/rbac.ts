import { auth } from "@/auth";

export type Role = "ADMIN" | "MANAGER" | "MERCHANDISER";

export class UnauthorizedError extends Error {}
export class ForbiddenError extends Error {}

/** Re-checked inside every route handler / server action that needs it — never rely on proxy.ts alone. */
export async function requireRole(...roles: Role[]) {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError();
  if (!roles.includes(session.user.role)) throw new ForbiddenError();
  return session;
}

export async function requireUser() {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError();
  return session;
}

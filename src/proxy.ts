import { NextResponse } from "next/server";
import { auth } from "@/auth";

const PUBLIC_PREFIXES = ["/login", "/api/auth"];
// /admin (import, users, stores) is ADMIN-only. /analytics and /feedback are open to
// every role — each sees a different slice once inside (a STORE user only ever sees
// their own store's data), enforced by the API routes, not by this gate.
const ADMIN_ONLY_PREFIXES = ["/admin"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isPublic = pathname === "/" || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));

  if (!req.auth?.user) {
    if (isPublic) return;
    const url = new URL("/login", req.nextUrl);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  const role = req.auth.user.role;

  if (ADMIN_ONLY_PREFIXES.some((p) => pathname.startsWith(p)) && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/planograms", req.nextUrl));
  }

  if (isPublic && pathname === "/login") {
    return NextResponse.redirect(new URL("/planograms", req.nextUrl));
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

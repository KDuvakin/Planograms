import { NextResponse } from "next/server";
import { auth } from "@/auth";

const PUBLIC_PREFIXES = ["/login", "/api/auth"];
// /admin (import, users, stores) is ADMIN-only; /analytics is ADMIN+MANAGER
// (a MANAGER only ever sees their own store's data once inside, enforced by
// the API routes — see src/app/api/planograms/route.ts and analytics routes).
const ADMIN_ONLY_PREFIXES = ["/admin"];
const STAFF_ONLY_PREFIXES = ["/analytics"];

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

  if (
    STAFF_ONLY_PREFIXES.some((p) => pathname.startsWith(p)) &&
    role !== "ADMIN" &&
    role !== "MANAGER"
  ) {
    return NextResponse.redirect(new URL("/planograms", req.nextUrl));
  }

  if (isPublic && pathname === "/login") {
    return NextResponse.redirect(new URL("/planograms", req.nextUrl));
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

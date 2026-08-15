import { NextResponse } from "next/server";
import { auth } from "@/auth";

const PUBLIC_PREFIXES = ["/login", "/api/auth"];
const MERCHANDISER_BLOCKED_PREFIXES = ["/admin", "/analytics"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isPublic = pathname === "/" || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));

  if (!req.auth?.user) {
    if (isPublic) return;
    const url = new URL("/login", req.nextUrl);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  if (
    req.auth.user.role === "MERCHANDISER" &&
    MERCHANDISER_BLOCKED_PREFIXES.some((p) => pathname.startsWith(p))
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

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const INTERNAL_HOST = "internal.getrestok.com";

export function middleware(req: NextRequest) {
  const host = (req.headers.get("host") || "").toLowerCase().split(":")[0];
  const { pathname } = req.nextUrl;

  // The internal admin subdomain serves the /internal app tree at its root, so
  // internal.getrestok.com/ → /internal and internal.getrestok.com/login →
  // /internal/login. (API routes and assets are excluded by the matcher.)
  if (host === INTERNAL_HOST) {
    const url = req.nextUrl.clone();
    url.pathname = pathname === "/" ? "/internal" : `/internal${pathname}`;
    return NextResponse.rewrite(url);
  }

  // Keep the internal admin panel off the public domain entirely.
  if (pathname === "/internal" || pathname.startsWith("/internal/")) {
    return new NextResponse("Not found", { status: 404 });
  }

  return NextResponse.next();
}

export const config = {
  // Run on pages only — skip API routes, Next internals, and static files.
  matcher: ["/((?!api/|_next/|.*\\.).*)"],
};

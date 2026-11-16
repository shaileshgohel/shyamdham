import { NextResponse, type NextRequest } from "next/server";

// Cheap first gate: no session cookie means straight to /login.
// The real check (valid, unexpired session; active user; role rights) runs on the server for every page and action.
const PUBLIC = ["/login", "/lang"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))) return NextResponse.next();
  if (!req.cookies.get("sd_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico|icon.svg|manifest.webmanifest).*)"],
};

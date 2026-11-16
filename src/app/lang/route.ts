import { NextResponse, type NextRequest } from "next/server";
import { LANG_COOKIE } from "@/lib/i18n";

export async function GET(req: NextRequest) {
  const to = req.nextUrl.searchParams.get("to") === "en" ? "en" : "gu";
  const back = req.nextUrl.searchParams.get("back") ?? "/dashboard";
  const safeBack = back.startsWith("/") && !back.startsWith("//") ? back : "/dashboard";
  const res = NextResponse.redirect(new URL(safeBack, req.url));
  res.cookies.set(LANG_COOKIE, to, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return res;
}

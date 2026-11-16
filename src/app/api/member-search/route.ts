import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { PermissionError, requireAny } from "@/lib/auth";
import { fullName } from "@/lib/format";

export async function GET(req: NextRequest) {
  try {
    await requireAny([["members", "view"], ["donations", "create"], ["bookings", "create"]]);
  } catch (e) {
    if (e instanceof PermissionError) return NextResponse.json([], { status: 403 });
    throw e;
  }
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 40);
  if (q.length < 2) return NextResponse.json([]);
  const digits = q.replace(/\D/g, "");
  const words = q.split(/\s+/).filter(Boolean).slice(0, 3);
  const heads = await db.member.findMany({
    where: {
      isHead: true,
      family: { isActive: true },
      AND: words.map((w) => ({
        OR: [
          { firstName: { contains: w, mode: "insensitive" as const } },
          { fatherName: { contains: w, mode: "insensitive" as const } },
          { surname: { contains: w, mode: "insensitive" as const } },
          { family: { familyNo: { contains: w, mode: "insensitive" as const } } },
          ...(digits.length >= 4 ? [{ mobile: { contains: digits } }] : []),
        ],
      })),
    },
    include: { family: true },
    take: 10,
    orderBy: { family: { familyNo: "asc" } },
  });
  return NextResponse.json(
    heads.map((m) => ({ familyId: m.familyId, familyNo: m.family.familyNo, name: fullName(m), mobile: m.mobile, address: [m.family.address, m.family.city].filter(Boolean).join(", ") || null, pan: m.pan })),
    { headers: { "Cache-Control": "no-store" } },
  );
}

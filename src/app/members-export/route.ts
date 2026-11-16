import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { actorOf, PermissionError, requirePermission } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { memberWhere, parseFilters } from "@/lib/members";
import { membersWorkbook } from "@/lib/excel";
import { fmtDate, todayIST } from "@/lib/format";

export async function GET(req: NextRequest) {
  let user;
  try {
    user = await requirePermission("members", "view");
  } catch (e) {
    if (e instanceof PermissionError) return new NextResponse("Forbidden", { status: 403 });
    throw e;
  }
  const f = parseFilters(Object.fromEntries(req.nextUrl.searchParams));
  const people = await db.member.findMany({
    where: memberWhere(f),
    orderBy: [{ family: { familyNo: "asc" } }, { sortOrder: "asc" }],
    include: { family: true },
    take: 20000,
  });
  const rows = people.map((m) => ({
    familyNo: m.family.familyNo,
    isHead: m.isHead ? "✓" : "",
    relation: m.relation,
    firstName: m.firstName,
    fatherName: m.fatherName,
    surname: m.surname,
    gender: m.gender === "M" ? "પુ" : m.gender === "F" ? "સ્ત્રી" : "",
    dob: fmtDate(m.dob),
    mobile: m.mobile,
    bloodGroup: m.bloodGroup,
    education: m.education,
    occupation: m.occupation,
    maritalStatus: m.maritalStatus,
    email: m.email,
    vatan: m.family.vatan,
    area: m.family.area,
    address: m.family.address,
    membershipType: m.family.membershipType,
    isAlive: m.isAlive ? "✓" : "✗",
  }));
  const buf = await membersWorkbook(rows, { title: "સભ્યો" });
  const filterText = Object.entries({ q: f.q, વતન: f.vatan, વિસ્તાર: f.area, વ્યવસાય: f.occupation, બ્લડ: f.bloodGroup }).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join(", ");
  await audit(actorOf(user), { action: "export", entity: "member", summary: `ડિરેક્ટરી Excel: ${rows.length} વ્યક્તિ${filterText ? ` (${filterText})` : ""}` });
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="shyamdham-members-${todayIST()}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}

import ExcelJS from "exceljs";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { actorOf, PermissionError, requireSuperAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { auditWhere, parseAuditFilters } from "@/lib/audit-query";
import { fmtDateTime, todayIST } from "@/lib/format";

export async function GET(req: NextRequest) {
  let user;
  try {
    user = await requireSuperAdmin();
  } catch (e) {
    if (e instanceof PermissionError) return new NextResponse("Forbidden", { status: 403 });
    throw e;
  }
  const f = parseAuditFilters(Object.fromEntries(req.nextUrl.searchParams));
  const rows = await db.auditLog.findMany({ where: auditWhere(f), orderBy: { at: "desc" }, take: 50000 });
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Audit log");
  ws.columns = [
    { header: "સમય (Time, IST)", key: "at", width: 20 },
    { header: "યુઝર (User)", key: "user", width: 18 },
    { header: "ક્રિયા (Action)", key: "action", width: 14 },
    { header: "પ્રકાર (Type)", key: "entity", width: 12 },
    { header: "દસ્તાવેજ (Document)", key: "docNo", width: 14 },
    { header: "વિગત (Details)", key: "summary", width: 50 },
    { header: "ફેરફાર (Changes)", key: "changes", width: 60 },
    { header: "ડિવાઇસ (Device)", key: "device", width: 20 },
    { header: "IP", key: "ip", width: 16 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  for (const r of rows) {
    const ch = r.changes as Record<string, [unknown, unknown]> | null;
    ws.addRow({
      at: fmtDateTime(r.at), user: r.userName, action: r.action, entity: r.entity, docNo: r.docNo, summary: r.summary,
      changes: ch ? Object.entries(ch).map(([k, [a, b]]) => `${k}: ${a ?? "—"} → ${b ?? "—"}`).join("\n") : "",
      device: r.device, ip: r.ip,
    });
  }
  const buf = Buffer.from(await wb.xlsx.writeBuffer());
  await audit(actorOf(user), { action: "export", entity: "session", summary: `ઓડિટ લોગ Excel: ${rows.length} નોંધ` });
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="shyamdham-audit-${todayIST()}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}

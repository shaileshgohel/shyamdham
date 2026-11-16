import { NextResponse } from "next/server";
import { PermissionError, requirePermission } from "@/lib/auth";
import { templateWorkbook } from "@/lib/excel";

export async function GET() {
  try {
    await requirePermission("members", "create");
  } catch (e) {
    if (e instanceof PermissionError) return new NextResponse("Forbidden", { status: 403 });
    throw e;
  }
  const buf = await templateWorkbook();
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="shyamdham-members-template.xlsx"',
    },
  });
}

import { db } from "@/lib/db";
import { PermissionError, requirePermission } from "@/lib/auth";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("accounts", "view");
  } catch (e) {
    if (e instanceof PermissionError) return new Response("Forbidden", { status: 403 });
    throw e;
  }
  const v = await db.voucher.findUnique({ where: { id: Number((await params).id) || 0 }, select: { attachment: true, attachmentType: true, attachmentName: true } });
  if (!v?.attachment) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(v.attachment), {
    headers: {
      "Content-Type": v.attachmentType ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="${encodeURIComponent(v.attachmentName ?? "bill")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

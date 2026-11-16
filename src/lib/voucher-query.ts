import "server-only";
import type { Prisma } from "@prisma/client";
import { dateOnly, fyRange, isYmd } from "./money";
import { todayIST } from "./format";

export type VoucherFilters = { from: string; to: string; type?: string; head?: number; account?: number; status: string; q?: string; source?: string };

export function parseVoucherFilters(sp: Record<string, string | string[] | undefined>): VoucherFilters {
  const g = (k: string) => { const v = sp[k]; const s = (Array.isArray(v) ? v[0] : v)?.trim(); return s ? s.slice(0, 60) : undefined; };
  const today = todayIST();
  const from = g("from"), to = g("to");
  return {
    from: isYmd(from) ? from : fyRange(today).from,
    to: isYmd(to) ? to : today,
    type: g("type"), head: Number(g("head")) || undefined, account: Number(g("account")) || undefined, source: g("source"),
    status: ["ACTIVE", "CANCELLED", "ALL"].includes(g("status") ?? "") ? g("status")! : "ACTIVE",
    q: g("q"),
  };
}

export function voucherWhere(f: VoucherFilters): Prisma.VoucherWhereInput {
  return {
    date: { gte: dateOnly(f.from), lte: dateOnly(f.to) },
    ...(f.status !== "ALL" ? { status: f.status } : {}),
    ...(f.type ? { type: f.type } : {}),
    ...(f.head ? { headId: f.head } : {}),
    ...(f.account ? { OR: [{ accountId: f.account }, { toAccountId: f.account }] } : {}),
    ...(f.source ? { source: f.source } : {}),
    ...(f.q ? { AND: [{ OR: [{ voucherNo: { contains: f.q, mode: "insensitive" } }, { party: { contains: f.q, mode: "insensitive" } }, { narration: { contains: f.q, mode: "insensitive" } }] }] } : {}),
  };
}

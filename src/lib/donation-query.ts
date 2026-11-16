import "server-only";
import type { Prisma } from "@prisma/client";
import { dateOnly, fyRange, isYmd } from "./money";
import { todayIST } from "./format";

export type DonationFilters = { from: string; to: string; head?: number; mode?: string; status: string; q?: string; user?: number };

export function parseDonationFilters(sp: Record<string, string | string[] | undefined>): DonationFilters {
  const g = (k: string) => { const v = sp[k]; const s = (Array.isArray(v) ? v[0] : v)?.trim(); return s ? s.slice(0, 60) : undefined; };
  const today = todayIST();
  const from = g("from"), to = g("to");
  return {
    from: isYmd(from) ? from : fyRange(today).from,
    to: isYmd(to) ? to : today,
    head: Number(g("head")) || undefined,
    mode: g("mode"),
    status: ["ACTIVE", "CANCELLED", "ALL"].includes(g("status") ?? "") ? g("status")! : "ACTIVE",
    q: g("q"),
    user: Number(g("user")) || undefined,
  };
}

export function donationWhere(f: DonationFilters): Prisma.DonationWhereInput {
  const digits = f.q?.replace(/\D/g, "") ?? "";
  return {
    date: { gte: dateOnly(f.from), lte: dateOnly(f.to) },
    ...(f.status !== "ALL" ? { status: f.status } : {}),
    ...(f.head ? { headId: f.head } : {}),
    ...(f.mode ? { mode: f.mode } : {}),
    ...(f.user ? { createdById: f.user } : {}),
    ...(f.q
      ? { OR: [{ donorName: { contains: f.q, mode: "insensitive" } }, { receiptNo: { contains: f.q, mode: "insensitive" } }, ...(digits.length >= 4 ? [{ mobile: { contains: digits } }] : [])] }
      : {}),
  };
}

export function filterQs(f: Record<string, unknown>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  return q;
}

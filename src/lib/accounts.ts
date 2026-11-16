import "server-only";
import { Prisma } from "@prisma/client";
import { db, nextCounter, type Tx } from "./db";
import { fyOf } from "./money";

export const VOUCHER_TYPES = ["INCOME", "EXPENSE", "DEPOSIT_IN", "DEPOSIT_OUT", "CONTRA"] as const;
export type VoucherType = (typeof VOUCHER_TYPES)[number];

// Number series per voucher type, restarting every financial year.
const SERIES: Record<VoucherType, string> = { INCOME: "AV", EXPENSE: "JV", DEPOSIT_IN: "DP", DEPOSIT_OUT: "DR", CONTRA: "CT" };
export const VOUCHER_TYPE_GU: Record<string, string> = { INCOME: "આવક", EXPENSE: "જાવક", DEPOSIT_IN: "ડિપોઝિટ જમા", DEPOSIT_OUT: "ડિપોઝિટ પરત", CONTRA: "ખાતાફેર" };
export const VOUCHER_TYPE_EN: Record<string, string> = { INCOME: "Income", EXPENSE: "Expense", DEPOSIT_IN: "Deposit received", DEPOSIT_OUT: "Deposit returned", CONTRA: "Transfer" };

/** Money coming into accountId (true) or going out (false). CONTRA is out of accountId and into toAccountId. */
export const isInflow = (type: string) => type === "INCOME" || type === "DEPOSIT_IN";

export async function nextDocNo(tx: Tx, prefix: string, date: Date) {
  const fy = fyOf(date);
  const n = await nextCounter(tx, `${prefix}:${fy}`);
  return { no: `${prefix}/${fy}/${String(n).padStart(4, "0")}`, fy };
}

export type NewVoucher = {
  type: VoucherType;
  date: Date;
  headId?: number | null;
  accountId: number;
  toAccountId?: number | null;
  amount: number;
  mode: string;
  reference?: string | null;
  party?: string | null;
  narration?: string | null;
  source?: "MANUAL" | "DONATION" | "BOOKING";
  donationId?: number | null;
  bookingId?: number | null;
  voucherNo?: string; // donations reuse their receipt number
  attachment?: { data: Buffer; type: string; name: string } | null;
};

export async function createVoucher(tx: Tx, v: NewVoucher, actor: { id: number; fullName: string }) {
  const voucherNo = v.voucherNo ?? (await nextDocNo(tx, SERIES[v.type], v.date)).no;
  return tx.voucher.create({
    data: {
      voucherNo,
      date: v.date,
      type: v.type,
      headId: v.headId ?? null,
      accountId: v.accountId,
      toAccountId: v.toAccountId ?? null,
      amount: new Prisma.Decimal(v.amount.toFixed(2)),
      mode: v.mode,
      reference: v.reference ?? null,
      party: v.party ?? null,
      narration: v.narration ?? null,
      source: v.source ?? "MANUAL",
      donationId: v.donationId ?? null,
      bookingId: v.bookingId ?? null,
      attachment: v.attachment ? new Uint8Array(v.attachment.data) : null,
      attachmentType: v.attachment?.type ?? null,
      attachmentName: v.attachment?.name ?? null,
      createdById: actor.id,
      createdByName: actor.fullName,
    },
  });
}

export async function systemHead(tx: Tx, key: string) {
  const h = await tx.accountHead.findUnique({ where: { systemKey: key } });
  if (!h) throw new Error(`System head ${key} missing; run npm run db:seed`);
  return h;
}

export type Balance = { id: number; name: string; kind: string; opening: number; inflow: number; outflow: number; balance: number };

/** Balance of each money account at the end of a day (inclusive), or now. */
export async function balances(asOfYmd?: string): Promise<Balance[]> {
  const asOf = asOfYmd ? Prisma.sql`AND v."date" <= ${asOfYmd}::date` : Prisma.empty;
  const rows = await db.$queryRaw<{ id: number; name: string; kind: string; opening: string; inflow: string; outflow: string }[]>`
    SELECT a.id, a.name, a.kind, a."openingBalance"::text AS opening,
      COALESCE((SELECT SUM(v.amount) FROM "Voucher" v WHERE v.status='ACTIVE' ${asOf}
        AND ((v."accountId"=a.id AND v.type IN ('INCOME','DEPOSIT_IN')) OR (v."toAccountId"=a.id AND v.type='CONTRA'))),0)::text AS inflow,
      COALESCE((SELECT SUM(v.amount) FROM "Voucher" v WHERE v.status='ACTIVE' ${asOf}
        AND v."accountId"=a.id AND v.type IN ('EXPENSE','DEPOSIT_OUT','CONTRA')),0)::text AS outflow
    FROM "MoneyAccount" a ORDER BY a."sortOrder", a.id`;
  return rows.map((r) => {
    const opening = Number(r.opening), inflow = Number(r.inflow), outflow = Number(r.outflow);
    return { id: r.id, name: r.name, kind: r.kind, opening, inflow, outflow, balance: opening + inflow - outflow };
  });
}

/** Refundable deposits currently held (received minus returned), overall or for one booking. */
export async function depositsHeld(bookingId?: number) {
  const where = { status: "ACTIVE", ...(bookingId ? { bookingId } : {}) };
  const [inn, out] = await Promise.all([
    db.voucher.aggregate({ where: { ...where, type: "DEPOSIT_IN" }, _sum: { amount: true } }),
    db.voucher.aggregate({ where: { ...where, type: "DEPOSIT_OUT" }, _sum: { amount: true } }),
  ]);
  return Number(inn._sum.amount ?? 0) - Number(out._sum.amount ?? 0);
}

export async function activeHeads(type?: "INCOME" | "EXPENSE") {
  return db.accountHead.findMany({ where: { isActive: true, ...(type ? { type } : {}) }, orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { nameGu: "asc" }] });
}

export async function activeAccounts() {
  return db.moneyAccount.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
}

/** Cash mode goes to a cash account; UPI, cheque and bank go to a bank account. */
export function accountFitsMode(kind: string, mode: string) {
  return mode === "ADJUST" || (mode === "CASH" ? kind === "CASH" : kind === "BANK");
}

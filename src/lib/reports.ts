import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { balances } from "./accounts";
import { addDays, dateOnly } from "./money";

const ACTIVE = { status: "ACTIVE" } as const;

export type HeadRow = { headId: number; nameGu: string; nameEn: string | null; type: string; count: number; total: number };

/** Income and expense per head for a period (deposits and transfers are not income or expense). */
export async function headwise(fromYmd: string, toYmd: string) {
  const rows = await db.voucher.groupBy({
    by: ["headId", "type"],
    where: { ...ACTIVE, type: { in: ["INCOME", "EXPENSE"] }, date: { gte: dateOnly(fromYmd), lte: dateOnly(toYmd) } },
    _sum: { amount: true },
    _count: { _all: true },
  });
  const heads = await db.accountHead.findMany();
  const byId = new Map(heads.map((h) => [h.id, h]));
  const out: HeadRow[] = rows
    .filter((r) => r.headId != null)
    .map((r) => {
      const h = byId.get(r.headId!)!;
      return { headId: h.id, nameGu: h.nameGu, nameEn: h.nameEn, type: r.type, count: r._count._all, total: Number(r._sum.amount ?? 0) };
    })
    .sort((a, b) => (byId.get(a.headId)!.sortOrder - byId.get(b.headId)!.sortOrder) || a.nameGu.localeCompare(b.nameGu));
  const income = out.filter((r) => r.type === "INCOME");
  const expense = out.filter((r) => r.type === "EXPENSE");
  const sum = (rs: HeadRow[]) => rs.reduce((n, r) => n + r.total, 0);
  return { income, expense, totalIncome: sum(income), totalExpense: sum(expense) };
}

/** Every voucher in a period with the opening and closing balance of each money account. */
export async function dayBook(fromYmd: string, toYmd: string) {
  const [vouchers, opening, closing] = await Promise.all([
    db.voucher.findMany({
      where: { ...ACTIVE, date: { gte: dateOnly(fromYmd), lte: dateOnly(toYmd) } },
      orderBy: [{ date: "asc" }, { id: "asc" }],
      include: { head: true, account: true, toAccount: true },
    }),
    balances(addDays(fromYmd, -1)),
    balances(toYmd),
  ]);
  return { vouchers, opening, closing };
}

/** Running ledger of one money account (cash book or bank book). */
export async function accountBook(accountId: number, fromYmd: string, toYmd: string) {
  const open = (await balances(addDays(fromYmd, -1))).find((b) => b.id === accountId);
  const vouchers = await db.voucher.findMany({
    where: { ...ACTIVE, date: { gte: dateOnly(fromYmd), lte: dateOnly(toYmd) }, OR: [{ accountId }, { toAccountId: accountId }] },
    orderBy: [{ date: "asc" }, { id: "asc" }],
    include: { head: true, account: true, toAccount: true },
  });
  let running = open?.balance ?? 0;
  const rows = vouchers.map((v) => {
    const amt = Number(v.amount);
    const inflow = v.type === "CONTRA" ? v.toAccountId === accountId : v.type === "INCOME" || v.type === "DEPOSIT_IN";
    running += inflow ? amt : -amt;
    return { v, receipt: inflow ? amt : 0, payment: inflow ? 0 : amt, balance: running };
  });
  return { opening: open?.balance ?? 0, rows, closing: running };
}

/** Head × month matrix for one financial year starting 1 April of startYear. */
export async function monthly(startYear: number) {
  const rows = await db.$queryRaw<{ headId: number; type: string; m: number; total: string }[]>`
    SELECT v."headId", v.type, EXTRACT(MONTH FROM v."date")::int AS m, SUM(v.amount)::text AS total
    FROM "Voucher" v
    WHERE v.status='ACTIVE' AND v.type IN ('INCOME','EXPENSE')
      AND v."date" BETWEEN ${`${startYear}-04-01`}::date AND ${`${startYear + 1}-03-31`}::date
    GROUP BY 1,2,3`;
  const heads = await db.accountHead.findMany({ orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { nameGu: "asc" }] });
  const order = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3]; // April → March
  const build = (type: string) =>
    heads
      .filter((h) => h.type === type)
      .map((h) => {
        const months = order.map((m) => Number(rows.find((r) => r.headId === h.id && r.m === m)?.total ?? 0));
        return { head: h, months, total: months.reduce((a, b) => a + b, 0) };
      })
      .filter((r) => r.total !== 0);
  const income = build("INCOME");
  const expense = build("EXPENSE");
  const col = (rs: typeof income) => order.map((_, i) => rs.reduce((n, r) => n + r.months[i], 0));
  return { order, income, expense, incomeByMonth: col(income), expenseByMonth: col(expense) };
}

/** Income and expense totals for each financial year that has entries. */
export async function yearly() {
  const rows = await db.$queryRaw<{ fy: number; type: string; total: string; n: number }[]>`
    SELECT (CASE WHEN EXTRACT(MONTH FROM v."date") >= 4 THEN EXTRACT(YEAR FROM v."date") ELSE EXTRACT(YEAR FROM v."date") - 1 END)::int AS fy,
           v.type, SUM(v.amount)::text AS total, COUNT(*)::int AS n
    FROM "Voucher" v WHERE v.status='ACTIVE' AND v.type IN ('INCOME','EXPENSE')
    GROUP BY 1,2 ORDER BY 1 DESC`;
  const years = Array.from(new Set(rows.map((r) => r.fy))).sort((a, b) => b - a);
  return years.map((y) => {
    const inc = Number(rows.find((r) => r.fy === y && r.type === "INCOME")?.total ?? 0);
    const exp = Number(rows.find((r) => r.fy === y && r.type === "EXPENSE")?.total ?? 0);
    return { startYear: y, label: `${y}-${String((y + 1) % 100).padStart(2, "0")}`, income: inc, expense: exp, surplus: inc - exp };
  });
}

export async function voucherTotals(where: Prisma.VoucherWhereInput) {
  const g = await db.voucher.groupBy({ by: ["type"], where: { ...where, ...ACTIVE }, _sum: { amount: true } });
  const t = (k: string) => Number(g.find((x) => x.type === k)?._sum.amount ?? 0);
  return { income: t("INCOME"), expense: t("EXPENSE"), depositIn: t("DEPOSIT_IN"), depositOut: t("DEPOSIT_OUT") };
}

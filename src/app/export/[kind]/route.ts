import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { actorOf, PermissionError, requirePermission } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { VOUCHER_TYPE_GU } from "@/lib/accounts";
import { accountBook, dayBook, headwise, monthly, yearly } from "@/lib/reports";
import { donationWhere, parseDonationFilters } from "@/lib/donation-query";
import { parseVoucherFilters, voucherWhere } from "@/lib/voucher-query";
import { simpleWorkbook, xlsxResponse, type Col } from "@/lib/sheet";
import { getSettings } from "@/lib/settings";
import { fmtDate, fmtDateTime, todayIST } from "@/lib/format";
import { fyRange, isYmd, MONTHS_GU, num, PAY_MODE_GU } from "@/lib/money";
import { stockByItem } from "@/lib/inventory";
import { BOOKING_STATUS_GU, SLOT_GU, summarize } from "@/lib/bookings";
import type { ModuleKey } from "@/lib/permissions";

const NEEDS: Record<string, ModuleKey> = { donations: "donations", vouchers: "accounts", report: "accounts", bookings: "bookings", inventory: "inventory" };

export async function GET(req: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  const kind = (await params).kind;
  const module = NEEDS[kind];
  if (!module) return new Response("Not found", { status: 404 });
  let user;
  try {
    user = await requirePermission(module, "view");
  } catch (e) {
    if (e instanceof PermissionError) return new Response("Forbidden", { status: 403 });
    throw e;
  }
  const sp = Object.fromEntries(req.nextUrl.searchParams);
  const s = await getSettings();
  const d = (x: Date | null) => (x ? fmtDate(x) : "");
  let buf: Buffer, name: string, summary: string;

  if (kind === "donations") {
    const f = parseDonationFilters(sp);
    const rows = await db.donation.findMany({ where: donationWhere(f), orderBy: [{ date: "asc" }, { id: "asc" }], include: { head: true }, take: 50000 });
    const cols: Col[] = [
      { header: "રસીદ નં.", key: "no", width: 16 }, { header: "તારીખ", key: "date", width: 12 }, { header: "દાતા", key: "donor", width: 28 },
      { header: "મોબાઈલ", key: "mobile", width: 13 }, { header: "PAN", key: "pan", width: 12 }, { header: "હેડ", key: "head", width: 20 },
      { header: "પેમેન્ટ", key: "mode", width: 10 }, { header: "ચેક / UTR", key: "ref", width: 14 }, { header: "રકમ", key: "amount", width: 14, money: true },
      { header: "સ્મરણાર્થે", key: "mem", width: 20 }, { header: "સ્થિતિ", key: "status", width: 10 }, { header: "બનાવનાર", key: "by", width: 16 }, { header: "બનાવ્યાનો સમય", key: "at", width: 18 },
    ];
    buf = await simpleWorkbook("દાન રજિસ્ટર", cols, rows.map((r) => ({
      no: r.receiptNo, date: d(r.date), donor: r.donorName, mobile: r.mobile, pan: r.pan, head: r.head.nameGu, mode: PAY_MODE_GU[r.mode] ?? r.mode, ref: r.reference,
      amount: num(r.amount), mem: r.inMemoryOf, status: r.status === "ACTIVE" ? "ચાલુ" : `રદ: ${r.cancelReason}`, by: r.createdByName, at: fmtDateTime(r.createdAt),
    })), { titleLines: [s.trust_name, `દાન રજિસ્ટર · ${d(new Date(`${f.from}T00:00:00Z`))} – ${d(new Date(`${f.to}T00:00:00Z`))}`], totals: { donor: "કુલ", amount: rows.filter((r) => r.status === "ACTIVE").reduce((n, r) => n + num(r.amount), 0) } });
    name = `donations-${f.from}-to-${f.to}.xlsx`;
    summary = `દાન રજિસ્ટર Excel: ${rows.length} રસીદ`;
  } else if (kind === "vouchers") {
    const f = parseVoucherFilters(sp);
    const rows = await db.voucher.findMany({ where: voucherWhere(f), orderBy: [{ date: "asc" }, { id: "asc" }], include: { head: true, account: true, toAccount: true }, take: 50000 });
    buf = await simpleWorkbook("વાઉચર", [
      { header: "નંબર", key: "no", width: 16 }, { header: "તારીખ", key: "date", width: 12 }, { header: "પ્રકાર", key: "type", width: 12 }, { header: "હેડ", key: "head", width: 20 },
      { header: "કોને / કોની પાસેથી", key: "party", width: 24 }, { header: "વિગત", key: "nar", width: 28 }, { header: "ખાતું", key: "acct", width: 18 }, { header: "પેમેન્ટ", key: "mode", width: 10 },
      { header: "ચેક / UTR", key: "ref", width: 14 }, { header: "રકમ", key: "amount", width: 14, money: true }, { header: "સ્થિતિ", key: "status", width: 10 }, { header: "બનાવનાર", key: "by", width: 16 },
    ], rows.map((v) => ({
      no: v.voucherNo, date: d(v.date), type: VOUCHER_TYPE_GU[v.type], head: v.head?.nameGu, party: v.party, nar: v.narration, acct: v.account.name + (v.toAccount ? ` → ${v.toAccount.name}` : ""),
      mode: PAY_MODE_GU[v.mode] ?? v.mode, ref: v.reference, amount: num(v.amount), status: v.status === "ACTIVE" ? "ચાલુ" : `રદ: ${v.cancelReason}`, by: v.createdByName,
    })), { titleLines: [s.trust_name, `વાઉચર યાદી · ${d(new Date(`${f.from}T00:00:00Z`))} – ${d(new Date(`${f.to}T00:00:00Z`))}`] });
    name = `vouchers-${f.from}-to-${f.to}.xlsx`;
    summary = `વાઉચર Excel: ${rows.length} એન્ટ્રી`;
  } else if (kind === "report") {
    const today = todayIST();
    const fy = fyRange(today);
    const r = sp.r ?? "daybook";
    const from = isYmd(sp.from) ? sp.from : r === "daybook" ? today : fy.from;
    const to = isYmd(sp.to) ? sp.to : today;
    const period = `${d(new Date(`${from}T00:00:00Z`))} – ${d(new Date(`${to}T00:00:00Z`))}`;
    if (r === "headwise") {
      const h = await headwise(from, to);
      const rows = [...h.income.map((x) => ({ type: "આવક", head: x.nameGu, count: x.count, amount: x.total })), { type: "", head: "કુલ આવક", amount: h.totalIncome },
        ...h.expense.map((x) => ({ type: "જાવક", head: x.nameGu, count: x.count, amount: x.total })), { type: "", head: "કુલ જાવક", amount: h.totalExpense }, { type: "", head: "વધારો / ઘટ", amount: h.totalIncome - h.totalExpense }];
      buf = await simpleWorkbook("હેડવાઈઝ", [{ header: "પ્રકાર", key: "type", width: 10 }, { header: "હેડ", key: "head", width: 28 }, { header: "એન્ટ્રી", key: "count", width: 10 }, { header: "રકમ", key: "amount", width: 16, money: true }], rows, { titleLines: [s.trust_name, `હેડવાઈઝ આવક-જાવક · ${period}`] });
    } else if (r === "monthly") {
      const start = Number(sp.fy) || fy.startYear;
      const m = await monthly(start);
      const cols: Col[] = [{ header: "હેડ", key: "head", width: 26 }, ...m.order.map((mo, i) => ({ header: MONTHS_GU[mo - 1], key: `m${i}`, width: 12, money: true })), { header: "કુલ", key: "total", width: 14, money: true }];
      const line = (head: string, months: number[]) => ({ head, ...Object.fromEntries(months.map((v, i) => [`m${i}`, v])), total: months.reduce((a, b) => a + b, 0) });
      const rows = [{ head: "આવક" }, ...m.income.map((x) => line(x.head.nameGu, x.months)), line("કુલ આવક", m.incomeByMonth), { head: "" }, { head: "જાવક" }, ...m.expense.map((x) => line(x.head.nameGu, x.months)), line("કુલ જાવક", m.expenseByMonth), line("વધારો / ઘટ", m.incomeByMonth.map((v, i) => v - m.expenseByMonth[i]))];
      buf = await simpleWorkbook("માસિક", cols, rows, { titleLines: [s.trust_name, `માસિક રિપોર્ટ · નાણાકીય વર્ષ ${start}-${String((start + 1) % 100).padStart(2, "0")}`] });
    } else if (r === "yearly") {
      const y = await yearly();
      buf = await simpleWorkbook("વાર્ષિક", [{ header: "નાણાકીય વર્ષ", key: "label", width: 14 }, { header: "આવક", key: "income", width: 16, money: true }, { header: "જાવક", key: "expense", width: 16, money: true }, { header: "વધારો / ઘટ", key: "surplus", width: 16, money: true }], y, { titleLines: [s.trust_name, "વાર્ષિક સારાંશ"] });
    } else if (r === "book") {
      const accountId = Number(sp.account);
      const acct = await db.moneyAccount.findUnique({ where: { id: accountId } });
      if (!acct) return new Response("Not found", { status: 404 });
      const b = await accountBook(accountId, from, to);
      buf = await simpleWorkbook(acct.name, [{ header: "તારીખ", key: "date", width: 12 }, { header: "નંબર", key: "no", width: 16 }, { header: "વિગત", key: "det", width: 40 }, { header: "જમા", key: "in", width: 14, money: true }, { header: "ઉધાર", key: "out", width: 14, money: true }, { header: "સિલક", key: "bal", width: 14, money: true }],
        [{ det: "ઉઘડતી સિલક", bal: b.opening }, ...b.rows.map(({ v, receipt, payment, balance }) => ({ date: d(v.date), no: v.voucherNo, det: [VOUCHER_TYPE_GU[v.type], v.head?.nameGu, v.party, v.narration].filter(Boolean).join(" · "), in: receipt || null, out: payment || null, bal: balance }))],
        { titleLines: [s.trust_name, `${acct.name} · ${period}`], totals: { det: "બંધ સિલક", in: b.rows.reduce((n, x) => n + x.receipt, 0), out: b.rows.reduce((n, x) => n + x.payment, 0), bal: b.closing } });
    } else {
      const b = await dayBook(from, to);
      buf = await simpleWorkbook("રોજમેળ", [{ header: "તારીખ", key: "date", width: 12 }, { header: "નંબર", key: "no", width: 16 }, { header: "પ્રકાર", key: "type", width: 12 }, { header: "હેડ / વિગત", key: "det", width: 40 }, { header: "ખાતું", key: "acct", width: 18 }, { header: "જમા", key: "in", width: 14, money: true }, { header: "ઉધાર", key: "out", width: 14, money: true }, { header: "બનાવનાર", key: "by", width: 16 }],
        b.vouchers.map((v) => { const inflow = v.type === "INCOME" || v.type === "DEPOSIT_IN"; return { date: d(v.date), no: v.voucherNo, type: VOUCHER_TYPE_GU[v.type], det: [v.head?.nameGu, v.party, v.narration].filter(Boolean).join(" · "), acct: v.account.name + (v.toAccount ? ` → ${v.toAccount.name}` : ""), in: inflow ? num(v.amount) : null, out: inflow ? null : num(v.amount), by: v.createdByName }; }),
        { titleLines: [s.trust_name, `રોજમેળ · ${period}`, ...b.opening.map((o) => `${o.name}: ઉઘડતી ${o.balance.toFixed(2)} · બંધ ${(b.closing.find((c) => c.id === o.id)?.balance ?? 0).toFixed(2)}`)] });
    }
    name = `report-${r}-${from}-to-${to}.xlsx`;
    summary = `હિસાબ રિપોર્ટ Excel: ${r}`;
  } else if (kind === "bookings") {
    const rows = await db.booking.findMany({ orderBy: { fromDate: "desc" }, include: { facilities: { include: { facility: true } }, lines: true, vouchers: true }, take: 20000 });
    buf = await simpleWorkbook("બુકિંગ", [
      { header: "બુકિંગ નં.", key: "no", width: 16 }, { header: "તારીખથી", key: "from", width: 12 }, { header: "તારીખ સુધી", key: "to", width: 12 }, { header: "સમય", key: "slot", width: 10 },
      { header: "સુવિધા", key: "fac", width: 24 }, { header: "પ્રસંગ", key: "event", width: 12 }, { header: "નામ", key: "name", width: 24 }, { header: "મોબાઈલ", key: "mobile", width: 13 },
      { header: "બિલ", key: "total", width: 12, money: true }, { header: "મળેલ", key: "paid", width: 12, money: true }, { header: "બાકી", key: "bal", width: 12, money: true }, { header: "ડિપોઝિટ પાસે", key: "dep", width: 12, money: true }, { header: "સ્થિતિ", key: "status", width: 10 }, { header: "બનાવનાર", key: "by", width: 16 },
    ], rows.map((b) => { const s2 = summarize(b); return { no: b.bookingNo, from: d(b.fromDate), to: d(b.toDate), slot: SLOT_GU[b.slot], fac: b.facilities.map((x) => x.facility.nameGu).join(", "), event: b.eventType, name: b.hirerName, mobile: b.mobile, total: s2.total, paid: s2.paid, bal: s2.balance, dep: s2.depositHeld, status: BOOKING_STATUS_GU[b.status], by: b.createdByName }; }), { titleLines: [s.trust_name, "વાડી બુકિંગ યાદી"] });
    name = `bookings-${todayIST()}.xlsx`;
    summary = `બુકિંગ Excel: ${rows.length}`;
  } else {
    const items = await db.item.findMany({ orderBy: [{ category: "asc" }, { nameGu: "asc" }] });
    const stock = await stockByItem();
    buf = await simpleWorkbook("ઇન્વેન્ટરી", [
      { header: "વસ્તુ", key: "name", width: 26 }, { header: "કેટેગરી", key: "cat", width: 14 }, { header: "સ્થળ", key: "loc", width: 14 }, { header: "એકમ", key: "unit", width: 8 },
      { header: "કુલ", key: "owned", width: 10 }, { header: "બહાર", key: "out", width: 10 }, { header: "નુકસાન", key: "dmg", width: 10 }, { header: "ઉપલબ્ધ", key: "avail", width: 10 }, { header: "ઓછામાં ઓછું", key: "min", width: 10 }, { header: "ચાર્જ દર", key: "rate", width: 10, money: true }, { header: "ચાલુ", key: "active", width: 8 },
    ], items.map((i) => { const st = stock(i.id); return { name: i.nameGu, cat: i.category, loc: i.location, unit: i.unit, owned: st.owned, out: st.out, dmg: st.damaged, avail: st.available, min: i.minQty, rate: num(i.chargeRate), active: i.isActive ? "હા" : "ના" }; }), { titleLines: [s.trust_name, `ઇન્વેન્ટરી · ${fmtDate(new Date(`${todayIST()}T00:00:00Z`))}`] });
    name = `inventory-${todayIST()}.xlsx`;
    summary = `ઇન્વેન્ટરી Excel: ${items.length} વસ્તુ`;
  }
  await audit(actorOf(user), { action: "export", entity: kind, summary });
  return xlsxResponse(buf, name);
}

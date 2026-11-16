import Link from "next/link";
import { Fragment } from "react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { can, canReadAudit } from "@/lib/permissions";
import { balances } from "@/lib/accounts";
import { voucherTotals } from "@/lib/reports";
import { summarize, SLOT_EN, SLOT_GU } from "@/lib/bookings";
import { stockByItem } from "@/lib/inventory";
import { AuditTable } from "@/components/audit-table";
import { fmtDate, istDayStart, todayIST } from "@/lib/format";
import { dateOnly, inr, MONTHS_EN, MONTHS_GU, fyRange } from "@/lib/money";

export const metadata = { title: "ડેશબોર્ડ" };

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ denied?: string; pw?: string }> }) {
  const user = await requireUser();
  const t = await getT();
  const sp = await searchParams;
  const r = user.role;
  const today = todayIST();
  const monthStart = today.slice(0, 8) + "01";
  const sa = canReadAudit(r);
  const show = { members: can(r, "members", "view"), accounts: can(r, "accounts", "view"), donations: can(r, "donations", "view"), bookings: can(r, "bookings", "view"), inventory: can(r, "inventory", "view") };

  const [families, members, todayT, bal, monthDon, upcoming, items, recentDocs, recent, monthly] = await Promise.all([
    show.members ? db.family.count({ where: { isActive: true } }) : 0,
    show.members ? db.member.count({ where: { family: { isActive: true }, isAlive: true } }) : 0,
    show.accounts ? voucherTotals({ date: dateOnly(today) }) : null,
    show.accounts ? balances() : [],
    show.donations ? db.donation.aggregate({ where: { status: "ACTIVE", date: { gte: dateOnly(monthStart), lte: dateOnly(today) } }, _sum: { amount: true }, _count: { _all: true } }) : null,
    show.bookings ? db.booking.findMany({ where: { status: "CONFIRMED", toDate: { gte: dateOnly(today) } }, include: { facilities: { include: { facility: true } }, lines: true, vouchers: true }, orderBy: { fromDate: "asc" }, take: 6 }) : [],
    show.inventory ? db.item.findMany({ where: { isActive: true, minQty: { gt: 0 } } }) : [],
    show.donations || show.bookings
      ? Promise.all([
          show.donations ? db.donation.findMany({ orderBy: { id: "desc" }, take: 6 }) : [],
          show.bookings ? db.booking.findMany({ orderBy: { id: "desc" }, take: 4, include: { lines: true, vouchers: true } }) : [],
        ])
      : [[], []],
    sa ? db.auditLog.findMany({ where: { at: { gte: istDayStart(today) } }, orderBy: { at: "desc" }, take: 8 }) : [],
    show.accounts
      ? db.$queryRaw<{ m: string; type: string; total: string }[]>`
          SELECT to_char(v."date", 'YYYY-MM') AS m, v.type, SUM(v.amount)::text AS total FROM "Voucher" v
          WHERE v.status='ACTIVE' AND v.type IN ('INCOME','EXPENSE') AND v."date" >= ${fyRange(today).from}::date
          GROUP BY 1,2 ORDER BY 1`
      : [],
  ]);
  const stock = show.inventory ? await stockByItem(items.map((i) => i.id)) : null;
  const lowStock = stock ? items.filter((i) => stock(i.id).available < i.minQty) : [];
  const totalBal = bal.reduce((n, b) => n + b.balance, 0);
  const [donations, bookings] = recentDocs as [Awaited<ReturnType<typeof db.donation.findMany>>, Awaited<ReturnType<typeof db.booking.findMany<{ include: { lines: true; vouchers: true } }>>>];
  const docs = [
    ...donations.map((d) => ({ key: `d${d.id}`, href: `/donations/${d.id}`, no: d.receiptNo, kind: t.g("દાન", "Donation"), name: d.donorName, amount: Number(d.amount), by: d.createdByName, at: d.createdAt, cancelled: d.status === "CANCELLED" })),
    ...bookings.map((b) => ({ key: `b${b.id}`, href: `/bookings/${b.id}`, no: b.bookingNo, kind: t.g("વાડી બિલ", "Wadi bill"), name: b.hirerName, amount: summarize(b).total, by: b.createdByName, at: b.createdAt, cancelled: b.status === "CANCELLED" })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 8);
  const months = Array.from(new Set(monthly.map((x) => x.m)));
  const maxBar = Math.max(1, ...monthly.map((x) => Number(x.total)));
  const monthNames = t.lang === "en" ? MONTHS_EN : MONTHS_GU;
  const slotL = (s: string) => (t.lang === "en" ? SLOT_EN : SLOT_GU)[s];

  return (
    <>
      {sp.denied && <p className="alert bad">{t("denied_page")}</p>}
      {sp.pw && <p className="alert ok">{t("password_changed")}</p>}
      <div className="pagehead">
        <div><h1>{t("dash_title")}</h1><p className="muted">{t.lang === "en" ? "Welcome" : "નમસ્તે"}, {user.fullName}</p></div>
        <div className="btns">
          {can(r, "donations", "create") && <Link className="btn pri" href="/donations/new">{t.g("+ નવી દાન રસીદ", "+ New receipt")}</Link>}
          {can(r, "bookings", "create") && <Link className="btn" href="/bookings/new">{t.g("+ નવું બુકિંગ", "+ New booking")}</Link>}
          {can(r, "accounts", "create") && <Link className="btn" href="/accounts/vouchers/new?type=EXPENSE">{t.g("+ જાવક", "+ Expense")}</Link>}
          {can(r, "members", "create") && <Link className="btn" href="/members/new">{t("quick_new_family")}</Link>}
        </div>
      </div>

      <div className="kpis">
        {todayT && <div className="kpi"><span>{t.g("આજની આવક", "Income today")}</span><b>{inr(todayT.income)}</b></div>}
        {todayT && <div className="kpi"><span>{t.g("આજની જાવક", "Expense today")}</span><b>{inr(todayT.expense)}</b></div>}
        {monthDon && <div className="kpi"><span>{t.g("આ મહિનાનું દાન", "Donations this month")}</span><b>{inr(monthDon._sum.amount)}</b></div>}
        {show.accounts && <div className="kpi"><span>{t.g("રોકડ + બેંક સિલક", "Cash + bank balance")}</span><b>{inr(totalBal)}</b></div>}
        {show.members && <div className="kpi"><span>{t("dash_families")}</span><b>{families.toLocaleString("en-IN")}</b></div>}
        {show.members && <div className="kpi"><span>{t("dash_members")}</span><b>{members.toLocaleString("en-IN")}</b></div>}
      </div>

      <div className="grid2">
        {show.accounts && months.length > 0 && (
          <section className="card">
            <h2>{t.g("માસિક આવક / જાવક", "Monthly income / expense")}</h2>
            <div className="hbars">
              {months.map((m) => {
                const inc = Number(monthly.find((x) => x.m === m && x.type === "INCOME")?.total ?? 0);
                const exp = Number(monthly.find((x) => x.m === m && x.type === "EXPENSE")?.total ?? 0);
                return (
                  <div key={m} style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: 8, alignItems: "center", fontSize: 13 }}>
                    <span>{monthNames[Number(m.slice(5)) - 1]}</span>
                    <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 6 }}><i style={{ display: "block", height: 9, width: `${(inc / maxBar) * 80}%`, minWidth: inc ? 2 : 0, background: "var(--brand)", borderRadius: 2 }} /><span className="small">{inr(inc)}</span></span>
                      <span style={{ display: "flex", alignItems: "center", gap: 6 }}><i style={{ display: "block", height: 9, width: `${(exp / maxBar) * 80}%`, minWidth: exp ? 2 : 0, background: "var(--gold)", borderRadius: 2 }} /><span className="small muted">{inr(exp)}</span></span>
                    </span>
                  </div>
                );
              })}
            </div>
            <span className="small muted"><span style={{ color: "var(--brand)" }}>■</span> {t.g("આવક", "Income")} &nbsp; <span style={{ color: "var(--gold)" }}>■</span> {t.g("જાવક", "Expense")}</span>
          </section>
        )}
        {(show.bookings || show.inventory) && (
          <section className="card">
            {show.bookings && (
              <>
                <div className="pagehead"><h2>{t.g("આગામી બુકિંગ", "Upcoming bookings")}</h2><Link className="small" href="/bookings">{t.g("કેલેન્ડર ›", "Calendar ›")}</Link></div>
                {upcoming.length ? upcoming.map((b) => {
                  const s = summarize(b);
                  return (
                    <Link key={b.id} href={`/bookings/${b.id}`} style={{ color: "inherit", textDecoration: "none" }}>
                      {fmtDate(b.fromDate)} · {b.facilities.map((f) => f.facility.nameGu).join(", ")} · {b.eventType}{b.slot !== "FULL" ? ` · ${slotL(b.slot)}` : ""} {s.balance > 0.001 ? <span className="chip bad">{t.g("બાકી", "due")} {inr(s.balance)}</span> : <span className="chip ok">{t.g("ભરાયેલ", "paid")}</span>}
                    </Link>
                  );
                }) : <p className="muted small">{t.g("કોઈ આગામી બુકિંગ નથી.", "No upcoming bookings.")}</p>}
              </>
            )}
            {show.inventory && (
              <>
                <div className="pagehead"><h2>{t.g("ઓછો સ્ટોક", "Low stock")}</h2><Link className="small" href="/inventory">{t.g("ઇન્વેન્ટરી ›", "Inventory ›")}</Link></div>
                {lowStock.length ? lowStock.map((i) => <Link key={i.id} href={`/inventory/${i.id}`}>{i.nameGu}: {stock!(i.id).available} / {i.minQty} {i.unit}</Link>) : <p className="muted small">{t.g("બધી વસ્તુ પૂરતી છે.", "Everything is in stock.")}</p>}
              </>
            )}
          </section>
        )}
        {show.accounts && bal.length > 0 && (
          <section className="card">
            <h2>{t.g("ખાતાની સિલક", "Account balances")}</h2>
            <dl className="kv">{bal.map((b) => <Fragment key={b.id}><dt>{b.name}</dt><dd className="num" style={{ textAlign: "left" }}>{inr(b.balance)}</dd></Fragment>)}</dl>
          </section>
        )}
        <section className="card">
          <h2>{t("dash_coming")}</h2>
          <p className="muted">{t("dash_coming_text")}</p>
        </section>
      </div>

      {docs.length > 0 && (
        <section className="card">
          <h2>{t.g("છેલ્લી રસીદ અને બિલ", "Latest receipts and bills")}</h2>
          <div className="tablewrap">
            <table className="t">
              <thead><tr><th>{t.g("નંબર", "No.")}</th><th>{t("type")}</th><th>{t("name")}</th><th className="num">{t.g("રકમ", "Amount")}</th><th>{t.g("બનાવનાર", "Created by")}</th><th>{t("time")}</th></tr></thead>
              <tbody>{docs.map((d) => <tr key={d.key} className={d.cancelled ? "dim" : undefined}><td className="nowrap"><Link href={d.href}>{d.no}</Link></td><td>{d.kind}{d.cancelled && <> <span className="chip bad">{t.g("રદ", "Cancelled")}</span></>}</td><td>{d.name}</td><td className="num">{inr(d.amount)}</td><td>{d.by}</td><td className="nowrap small">{fmtDate(d.at)} {d.at.toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      )}

      {sa && recent.length > 0 && (
        <section className="card">
          <div className="pagehead"><h2>{t.g("આજની પ્રવૃત્તિ", "Today's activity")}</h2><Link href="/audit" className="small">{t("nav_audit")} ›</Link></div>
          <AuditTable rows={recent} t={t} />
        </section>
      )}
    </>
  );
}

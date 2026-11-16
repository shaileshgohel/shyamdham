import Link from "next/link";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";
import { VOUCHER_TYPE_EN, VOUCHER_TYPE_GU } from "@/lib/accounts";
import { accountBook, dayBook, headwise, monthly, yearly } from "@/lib/reports";
import { fmtDate, todayIST } from "@/lib/format";
import { fyRange, inr, isYmd, MONTHS_EN, MONTHS_GU } from "@/lib/money";
import { filterQs } from "@/lib/donation-query";
import { PrintButton } from "../../members/print/print-button";
import { AccountsTabs } from "../nav";

export const metadata = { title: "હિસાબ રિપોર્ટ" };
const TABS = ["daybook", "headwise", "monthly", "yearly", "book"] as const;

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePage("accounts", "view");
  const t = await getT();
  const sp = await searchParams;
  const tab = (TABS as readonly string[]).includes(sp.r ?? "") ? sp.r! : "daybook";
  const today = todayIST();
  const fy = fyRange(today);
  const from = isYmd(sp.from) ? sp.from : tab === "daybook" ? today : fy.from;
  const to = isYmd(sp.to) ? sp.to : today;
  const fyStart = Number(sp.fy) || fy.startYear;
  const accounts = await db.moneyAccount.findMany({ orderBy: { sortOrder: "asc" } });
  const accountId = Number(sp.account) || accounts[0]?.id;
  const settings = await getSettings();
  const typeLabel = (k: string) => (t.lang === "en" ? VOUCHER_TYPE_EN : VOUCHER_TYPE_GU)[k] ?? k;
  const months = t.lang === "en" ? MONTHS_EN : MONTHS_GU;
  const qs = filterQs({ r: tab, from, to, fy: fyStart, account: accountId });
  const tabName: Record<string, [string, string]> = { daybook: ["રોજમેળ", "Day book"], headwise: ["હેડવાઈઝ", "Head-wise"], monthly: ["માસિક", "Monthly"], yearly: ["વાર્ષિક", "Yearly"], book: ["રોકડ / બેંક બુક", "Cash / bank book"] };
  const fyOptions = Array.from({ length: 6 }, (_, i) => fy.startYear - i);

  let body: React.ReactNode = null;
  let period = `${fmtDate(new Date(`${from}T00:00:00Z`))} – ${fmtDate(new Date(`${to}T00:00:00Z`))}`;

  if (tab === "daybook") {
    const r = await dayBook(from, to);
    const inT = r.vouchers.filter((v) => v.type === "INCOME" || v.type === "DEPOSIT_IN").reduce((n, v) => n + Number(v.amount), 0);
    const outT = r.vouchers.filter((v) => v.type === "EXPENSE" || v.type === "DEPOSIT_OUT").reduce((n, v) => n + Number(v.amount), 0);
    body = (
      <>
        <BalTable t={t} opening={r.opening} closing={r.closing} />
        <div className="tablewrap">
          <table className="t">
            <thead><tr><th>{t.g("તારીખ", "Date")}</th><th>{t.g("નંબર", "No.")}</th><th>{t("type")}</th><th>{t.g("હેડ / વિગત", "Head / details")}</th><th>{t.g("ખાતું", "Account")}</th><th className="num">{t.g("જમા", "Receipt")}</th><th className="num">{t.g("ઉધાર", "Payment")}</th><th>{t.g("બનાવનાર", "By")}</th></tr></thead>
            <tbody>
              {r.vouchers.map((v) => {
                const inflow = v.type === "INCOME" || v.type === "DEPOSIT_IN";
                return (
                  <tr key={v.id}>
                    <td className="nowrap">{fmtDate(v.date)}</td>
                    <td className="nowrap"><Link href={`/accounts/vouchers/${v.id}`}>{v.voucherNo}</Link></td>
                    <td>{typeLabel(v.type)}</td>
                    <td>{v.head?.nameGu ?? ""}{v.party ? ` · ${v.party}` : ""}{v.narration ? ` · ${v.narration}` : ""}</td>
                    <td className="small">{v.account.name}{v.toAccount ? ` → ${v.toAccount.name}` : ""}</td>
                    <td className="num">{inflow ? inr(v.amount) : ""}</td>
                    <td className="num">{!inflow && v.type !== "CONTRA" ? inr(v.amount) : v.type === "CONTRA" ? <span className="muted">{inr(v.amount)}</span> : ""}</td>
                    <td className="small">{v.createdByName}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot><tr><td colSpan={5}>{t.g("કુલ", "Total")}</td><td className="num">{inr(inT)}</td><td className="num">{inr(outT)}</td><td></td></tr></tfoot>
          </table>
        </div>
        {!r.vouchers.length && <p className="muted">{t.g("આ સમયગાળામાં કોઈ એન્ટ્રી નથી.", "No entries in this period.")}</p>}
      </>
    );
  } else if (tab === "headwise") {
    const r = await headwise(from, to);
    const Side = ({ title, rows, total }: { title: string; rows: typeof r.income; total: number }) => (
      <div className="tablewrap">
        <table className="t">
          <thead><tr><th>{title}</th><th className="num">{t.g("એન્ટ્રી", "Entries")}</th><th className="num">{t.g("રકમ", "Amount")}</th></tr></thead>
          <tbody>{rows.map((h) => <tr key={h.headId}><td><Link href={`/accounts/vouchers?${filterQs({ head: h.headId, from, to })}`}>{t.lang === "en" ? h.nameEn ?? h.nameGu : h.nameGu}</Link></td><td className="num">{h.count}</td><td className="num">{inr(h.total)}</td></tr>)}</tbody>
          <tfoot><tr><td>{t.g("કુલ", "Total")}</td><td></td><td className="num">{inr(total)}</td></tr></tfoot>
        </table>
      </div>
    );
    body = (
      <>
        <div className="grid2"><Side title={t.g("આવક", "Income")} rows={r.income} total={r.totalIncome} /><Side title={t.g("જાવક", "Expense")} rows={r.expense} total={r.totalExpense} /></div>
        <div className="kpis"><div className="kpi"><span>{r.totalIncome >= r.totalExpense ? t.g("વધારો", "Surplus") : t.g("ઘટ", "Deficit")}</span><b className={r.totalIncome >= r.totalExpense ? "pos" : "neg"}>{inr(Math.abs(r.totalIncome - r.totalExpense))}</b></div></div>
      </>
    );
  } else if (tab === "monthly") {
    const r = await monthly(fyStart);
    period = `${t.g("નાણાકીય વર્ષ", "Financial year")} ${fyStart}-${String((fyStart + 1) % 100).padStart(2, "0")}`;
    const Block = ({ title, rows, totals }: { title: string; rows: typeof r.income; totals: number[] }) => (
      <>
        <tr><th colSpan={14} style={{ textAlign: "left" }}>{title}</th></tr>
        {rows.map((x) => <tr key={x.head.id}><td>{x.head.nameGu}</td>{x.months.map((m, i) => <td key={i} className="num">{m ? inr(m, { symbol: false }) : ""}</td>)}<td className="num"><b>{inr(x.total, { symbol: false })}</b></td></tr>)}
        <tr><td><b>{t.g("કુલ", "Total")}</b></td>{totals.map((m, i) => <td key={i} className="num"><b>{inr(m, { symbol: false })}</b></td>)}<td className="num"><b>{inr(totals.reduce((a, b) => a + b, 0), { symbol: false })}</b></td></tr>
      </>
    );
    body = (
      <div className="tablewrap">
        <table className="t small">
          <thead><tr><th>{t.g("હેડ", "Head")}</th>{r.order.map((m) => <th key={m} className="num">{months[m - 1].slice(0, 3)}</th>)}<th className="num">{t.g("કુલ", "Total")}</th></tr></thead>
          <tbody>
            <Block title={t.g("આવક", "Income")} rows={r.income} totals={r.incomeByMonth} />
            <Block title={t.g("જાવક", "Expense")} rows={r.expense} totals={r.expenseByMonth} />
            <tr><td><b>{t.g("વધારો / ઘટ", "Surplus")}</b></td>{r.incomeByMonth.map((m, i) => { const s = m - r.expenseByMonth[i]; return <td key={i} className={`num ${s < 0 ? "neg" : ""}`}><b>{inr(s, { symbol: false })}</b></td>; })}<td className="num"><b>{inr(r.incomeByMonth.reduce((a, b) => a + b, 0) - r.expenseByMonth.reduce((a, b) => a + b, 0), { symbol: false })}</b></td></tr>
          </tbody>
        </table>
      </div>
    );
  } else if (tab === "yearly") {
    const r = await yearly();
    period = "";
    body = (
      <div className="tablewrap">
        <table className="t">
          <thead><tr><th>{t.g("નાણાકીય વર્ષ", "Financial year")}</th><th className="num">{t.g("આવક", "Income")}</th><th className="num">{t.g("જાવક", "Expense")}</th><th className="num">{t.g("વધારો / ઘટ", "Surplus / deficit")}</th><th></th></tr></thead>
          <tbody>{r.map((y) => <tr key={y.startYear}><td>{y.label}</td><td className="num">{inr(y.income)}</td><td className="num">{inr(y.expense)}</td><td className={`num ${y.surplus < 0 ? "neg" : "pos"}`}>{inr(y.surplus)}</td><td><Link className="small" href={`/accounts/reports?r=headwise&from=${y.startYear}-04-01&to=${y.startYear + 1}-03-31`}>{t.g("હેડવાઈઝ ›", "Head-wise ›")}</Link></td></tr>)}</tbody>
        </table>
        {!r.length && <p className="muted" style={{ padding: 16 }}>{t("none_found")}</p>}
      </div>
    );
  } else if (tab === "book" && accountId) {
    const r = await accountBook(accountId, from, to);
    body = (
      <div className="tablewrap">
        <table className="t">
          <thead><tr><th>{t.g("તારીખ", "Date")}</th><th>{t.g("નંબર", "No.")}</th><th>{t.g("વિગત", "Details")}</th><th className="num">{t.g("જમા", "In")}</th><th className="num">{t.g("ઉધાર", "Out")}</th><th className="num">{t.g("સિલક", "Balance")}</th></tr></thead>
          <tbody>
            <tr><td colSpan={5}><b>{t.g("ઉઘડતી સિલક", "Opening balance")}</b></td><td className="num"><b>{inr(r.opening)}</b></td></tr>
            {r.rows.map(({ v, receipt, payment, balance }) => (
              <tr key={v.id}><td className="nowrap">{fmtDate(v.date)}</td><td className="nowrap"><Link href={`/accounts/vouchers/${v.id}`}>{v.voucherNo}</Link></td><td>{typeLabel(v.type)} · {v.head?.nameGu ?? (v.type === "CONTRA" ? `${v.account.name} → ${v.toAccount?.name}` : "")}{v.party ? ` · ${v.party}` : ""}</td><td className="num">{receipt ? inr(receipt) : ""}</td><td className="num">{payment ? inr(payment) : ""}</td><td className="num">{inr(balance)}</td></tr>
            ))}
          </tbody>
          <tfoot><tr><td colSpan={3}>{t.g("બંધ સિલક", "Closing balance")}</td><td className="num">{inr(r.rows.reduce((n, x) => n + x.receipt, 0))}</td><td className="num">{inr(r.rows.reduce((n, x) => n + x.payment, 0))}</td><td className="num">{inr(r.closing)}</td></tr></tfoot>
        </table>
      </div>
    );
  }

  return (
    <>
      <div className="pagehead no-print">
        <div><h1>{t.g("હિસાબ રિપોર્ટ", "Account reports")}</h1></div>
        <div className="btns"><a className="btn" href={`/export/report?${qs}`}>Excel</a><PrintButton label={t.g("છાપો / PDF", "Print / PDF")} /></div>
      </div>
      <AccountsTabs t={t} on="/accounts/reports" />
      <nav className="btns no-print">{TABS.map((k) => <Link key={k} href={`/accounts/reports?r=${k}`} className={`btn sm${k === tab ? " pri" : ""}`}>{t.g(...tabName[k])}</Link>)}</nav>
      <form className="card no-print" method="get">
        <input type="hidden" name="r" value={tab} />
        <div className="fields">
          {tab === "monthly" ? (
            <div className="field"><label htmlFor="fy">{t.g("નાણાકીય વર્ષ", "Financial year")}</label><select id="fy" name="fy" defaultValue={fyStart}>{fyOptions.map((y) => <option key={y} value={y}>{y}-{String((y + 1) % 100).padStart(2, "0")}</option>)}</select></div>
          ) : tab !== "yearly" ? (
            <>
              <div className="field"><label htmlFor="from">{t("from_date")}</label><input id="from" name="from" type="date" defaultValue={from} /></div>
              <div className="field"><label htmlFor="to">{t("to_date")}</label><input id="to" name="to" type="date" defaultValue={to} /></div>
            </>
          ) : null}
          {tab === "book" && <div className="field"><label htmlFor="account">{t.g("ખાતું", "Account")}</label><select id="account" name="account" defaultValue={accountId}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>}
        </div>
        {tab !== "yearly" && <div className="btns"><button className="btn pri" type="submit">{t.g("બતાવો", "Show")}</button></div>}
      </form>
      <div className="print-only" style={{ textAlign: "center" }}>
        <h1>{settings.trust_name}</h1>
        <p>{t.g(...tabName[tab])}{tab === "book" ? ` · ${accounts.find((a) => a.id === accountId)?.name}` : ""}{period ? ` · ${period}` : ""}</p>
      </div>
      {body}
    </>
  );
}

function BalTable({ t, opening, closing }: { t: Awaited<ReturnType<typeof getT>>; opening: { id: number; name: string; balance: number }[]; closing: { id: number; balance: number }[] }) {
  return (
    <div className="tablewrap">
      <table className="t">
        <thead><tr><th>{t.g("ખાતું", "Account")}</th><th className="num">{t.g("ઉઘડતી સિલક", "Opening")}</th><th className="num">{t.g("બંધ સિલક", "Closing")}</th></tr></thead>
        <tbody>{opening.map((o) => <tr key={o.id}><td>{o.name}</td><td className="num">{inr(o.balance)}</td><td className="num">{inr(closing.find((c) => c.id === o.id)?.balance ?? 0)}</td></tr>)}</tbody>
        <tfoot><tr><td>{t.g("કુલ", "Total")}</td><td className="num">{inr(opening.reduce((n, o) => n + o.balance, 0))}</td><td className="num">{inr(closing.reduce((n, c) => n + c.balance, 0))}</td></tr></tfoot>
      </table>
    </div>
  );
}

import Link from "next/link";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { can } from "@/lib/permissions";
import { balances, depositsHeld, VOUCHER_TYPE_EN, VOUCHER_TYPE_GU } from "@/lib/accounts";
import { voucherTotals } from "@/lib/reports";
import { fmtDate, todayIST } from "@/lib/format";
import { dateOnly, fyRange, inr } from "@/lib/money";
import { AccountsTabs } from "./nav";

export const metadata = { title: "હિસાબ" };

export default async function AccountsPage() {
  const user = await requirePage("accounts", "view");
  const t = await getT();
  const today = todayIST();
  const fy = fyRange(today);
  const monthStart = today.slice(0, 8) + "01";
  const [bal, held, todayT, monthT, fyT, recent] = await Promise.all([
    balances(),
    depositsHeld(),
    voucherTotals({ date: dateOnly(today) }),
    voucherTotals({ date: { gte: dateOnly(monthStart), lte: dateOnly(today) } }),
    voucherTotals({ date: { gte: dateOnly(fy.from), lte: dateOnly(today) } }),
    db.voucher.findMany({ orderBy: { id: "desc" }, take: 10, include: { head: true, account: true } }),
  ]);
  const total = bal.reduce((n, b) => n + b.balance, 0);
  const typeLabel = (k: string) => (t.lang === "en" ? VOUCHER_TYPE_EN : VOUCHER_TYPE_GU)[k] ?? k;
  return (
    <>
      <div className="pagehead">
        <div><h1>{t.g("હિસાબ", "Accounts")}</h1><p className="muted small">{t.g(`નાણાકીય વર્ષ ${fy.label}`, `Financial year ${fy.label}`)}</p></div>
        {can(user.role, "accounts", "create") && (
          <div className="btns">
            <Link className="btn pri" href="/accounts/vouchers/new?type=INCOME">{t.g("+ આવક", "+ Income")}</Link>
            <Link className="btn pri" href="/accounts/vouchers/new?type=EXPENSE">{t.g("+ જાવક", "+ Expense")}</Link>
            <Link className="btn" href="/accounts/vouchers/new?type=CONTRA">{t.g("ખાતાફેર", "Transfer")}</Link>
          </div>
        )}
      </div>
      <AccountsTabs t={t} on="/accounts" />
      <div className="kpis">
        {bal.map((b) => <div key={b.id} className="kpi"><span>{b.name}</span><b className={b.balance < 0 ? "neg" : undefined}>{inr(b.balance)}</b></div>)}
        <div className="kpi"><span>{t.g("કુલ સિલક", "Total balance")}</span><b>{inr(total)}</b></div>
        {held !== 0 && <div className="kpi"><span>{t.g("પરત આપવાની ડિપોઝિટ", "Deposits to return")}</span><b>{inr(held)}</b></div>}
      </div>
      <div className="tablewrap">
        <table className="t">
          <thead><tr><th></th><th className="num">{t.g("આવક", "Income")}</th><th className="num">{t.g("જાવક", "Expense")}</th><th className="num">{t.g("વધારો / ઘટ", "Surplus / deficit")}</th></tr></thead>
          <tbody>
            {([[t.g("આજે", "Today"), todayT], [t.g("આ મહિને", "This month"), monthT], [t.g(`આ વર્ષ (${fy.label})`, `This year (${fy.label})`), fyT]] as const).map(([label, x]) => (
              <tr key={label}><td>{label}</td><td className="num">{inr(x.income)}</td><td className="num">{inr(x.expense)}</td><td className={`num ${x.income - x.expense < 0 ? "neg" : "pos"}`}>{inr(x.income - x.expense)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <section className="card">
        <div className="pagehead"><h2>{t.g("છેલ્લી એન્ટ્રી", "Latest entries")}</h2><Link className="small" href="/accounts/vouchers">{t.g("બધા વાઉચર ›", "All vouchers ›")}</Link></div>
        <div className="tablewrap">
          <table className="t">
            <thead><tr><th>{t.g("નંબર", "No.")}</th><th>{t.g("તારીખ", "Date")}</th><th>{t("type")}</th><th>{t.g("હેડ / વિગત", "Head / details")}</th><th>{t.g("ખાતું", "Account")}</th><th className="num">{t.g("રકમ", "Amount")}</th><th>{t.g("બનાવનાર", "By")}</th></tr></thead>
            <tbody>
              {recent.map((v) => (
                <tr key={v.id} className={v.status === "CANCELLED" ? "dim" : undefined}>
                  <td className="nowrap"><Link href={`/accounts/vouchers/${v.id}`}>{v.voucherNo}</Link></td>
                  <td className="nowrap">{fmtDate(v.date)}</td>
                  <td>{typeLabel(v.type)}</td>
                  <td>{v.head?.nameGu ?? "—"}{v.party ? ` · ${v.party}` : ""}</td>
                  <td>{v.account.name}</td>
                  <td className="num">{inr(v.amount)}</td>
                  <td>{v.createdByName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

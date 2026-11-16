import Link from "next/link";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { can } from "@/lib/permissions";
import { VOUCHER_TYPE_EN, VOUCHER_TYPE_GU } from "@/lib/accounts";
import { parseVoucherFilters, voucherWhere } from "@/lib/voucher-query";
import { filterQs } from "@/lib/donation-query";
import { fmtDate } from "@/lib/format";
import { inr, PAY_MODE_EN, PAY_MODE_GU } from "@/lib/money";
import { AccountsTabs } from "../nav";

export const metadata = { title: "વાઉચર" };
const PAGE = 50;

export default async function VouchersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePage("accounts", "view");
  const t = await getT();
  const sp = await searchParams;
  const f = parseVoucherFilters(sp);
  const page = Math.max(1, Number(sp.page) || 1);
  const where = voucherWhere(f);
  const [rows, count, sums, heads, accounts] = await Promise.all([
    db.voucher.findMany({ where, orderBy: [{ date: "desc" }, { id: "desc" }], skip: (page - 1) * PAGE, take: PAGE, include: { head: true, account: true, toAccount: true } }),
    db.voucher.count({ where }),
    db.voucher.groupBy({ by: ["type"], where, _sum: { amount: true } }),
    db.accountHead.findMany({ orderBy: [{ type: "asc" }, { sortOrder: "asc" }] }),
    db.moneyAccount.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  const qs = filterQs(f);
  const withPage = (p: number) => { const q = new URLSearchParams(qs); if (p > 1) q.set("page", String(p)); return `/accounts/vouchers?${q}`; };
  const typeLabel = (k: string) => (t.lang === "en" ? VOUCHER_TYPE_EN : VOUCHER_TYPE_GU)[k] ?? k;
  const sumOf = (k: string) => Number(sums.find((s) => s.type === k)?._sum.amount ?? 0);
  return (
    <>
      <div className="pagehead">
        <div><h1>{t.g("વાઉચર", "Vouchers")}</h1></div>
        <div className="btns">
          <a className="btn" href={`/export/vouchers?${qs}`}>Excel</a>
          {can(user.role, "accounts", "create") && <><Link className="btn pri" href="/accounts/vouchers/new?type=INCOME">{t.g("+ આવક", "+ Income")}</Link><Link className="btn pri" href="/accounts/vouchers/new?type=EXPENSE">{t.g("+ જાવક", "+ Expense")}</Link></>}
        </div>
      </div>
      <AccountsTabs t={t} on="/accounts/vouchers" />
      <form className="card" method="get">
        <div className="fields">
          <div className="field"><label htmlFor="from">{t("from_date")}</label><input id="from" name="from" type="date" defaultValue={f.from} /></div>
          <div className="field"><label htmlFor="to">{t("to_date")}</label><input id="to" name="to" type="date" defaultValue={f.to} /></div>
          <div className="field"><label htmlFor="type">{t("type")}</label><select id="type" name="type" defaultValue={f.type ?? ""}><option value="">{t("all")}</option>{["INCOME", "EXPENSE", "DEPOSIT_IN", "DEPOSIT_OUT", "CONTRA"].map((k) => <option key={k} value={k}>{typeLabel(k)}</option>)}</select></div>
          <div className="field"><label htmlFor="head">{t.g("હેડ", "Head")}</label><select id="head" name="head" defaultValue={f.head ?? ""}><option value="">{t("all")}</option>{heads.map((h) => <option key={h.id} value={h.id}>{typeLabel(h.type)} · {t.lang === "en" ? h.nameEn ?? h.nameGu : h.nameGu}</option>)}</select></div>
          <div className="field"><label htmlFor="account">{t.g("ખાતું", "Account")}</label><select id="account" name="account" defaultValue={f.account ?? ""}><option value="">{t("all")}</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
          <div className="field"><label htmlFor="status">{t("status")}</label><select id="status" name="status" defaultValue={f.status}><option value="ACTIVE">{t.g("ચાલુ", "Valid")}</option><option value="CANCELLED">{t.g("રદ", "Cancelled")}</option><option value="ALL">{t("all")}</option></select></div>
          <div className="field"><label htmlFor="q">{t("search")}</label><input id="q" name="q" type="search" defaultValue={f.q} placeholder={t.g("નંબર, નામ, વિગત", "No., name, details")} /></div>
        </div>
        <div className="btns"><button className="btn pri" type="submit">{t("filter")}</button><Link className="btn" href="/accounts/vouchers">{t.g("આ વર્ષ", "This year")}</Link></div>
      </form>
      <div className="kpis">
        <div className="kpi"><span>{t.g("આવક", "Income")}</span><b>{inr(sumOf("INCOME"))}</b></div>
        <div className="kpi"><span>{t.g("જાવક", "Expense")}</span><b>{inr(sumOf("EXPENSE"))}</b></div>
        <div className="kpi"><span>{t.g("એન્ટ્રી", "Entries")}</span><b>{count}</b></div>
      </div>
      <div className="tablewrap">
        {rows.length ? (
          <table className="t">
            <thead><tr><th>{t.g("નંબર", "No.")}</th><th>{t.g("તારીખ", "Date")}</th><th>{t("type")}</th><th>{t.g("હેડ", "Head")}</th><th>{t.g("કોને / કોની પાસેથી", "Party")}</th><th>{t.g("ખાતું", "Account")}</th><th className="num">{t.g("રકમ", "Amount")}</th><th>{t.g("બનાવનાર", "By")}</th></tr></thead>
            <tbody>
              {rows.map((v) => (
                <tr key={v.id} className={v.status === "CANCELLED" ? "dim" : undefined}>
                  <td className="nowrap"><Link href={`/accounts/vouchers/${v.id}`}>{v.voucherNo}</Link>{v.attachment ? " 📎" : ""}</td>
                  <td className="nowrap">{fmtDate(v.date)}</td>
                  <td>{typeLabel(v.type)}{v.status === "CANCELLED" && <> <span className="chip bad">{t.g("રદ", "Cancelled")}</span></>}</td>
                  <td>{v.head?.nameGu ?? "—"}</td>
                  <td>{v.party ?? v.narration ?? ""}</td>
                  <td className="small">{v.account.name}{v.toAccount ? ` → ${v.toAccount.name}` : ""} · {(t.lang === "en" ? PAY_MODE_EN : PAY_MODE_GU)[v.mode] ?? v.mode}</td>
                  <td className={`num ${v.type === "EXPENSE" || v.type === "DEPOSIT_OUT" ? "neg" : ""}`}>{inr(v.amount)}</td>
                  <td>{v.createdByName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="muted" style={{ padding: 16 }}>{t("none_found")}</p>}
      </div>
      <div className="pager">
        <span>{t("showing", { from: count ? (page - 1) * PAGE + 1 : 0, to: Math.min(count, page * PAGE), total: count })}</span>
        <div className="btns">{page > 1 && <Link className="btn sm" href={withPage(page - 1)}>{t("prev")}</Link>}{page * PAGE < count && <Link className="btn sm" href={withPage(page + 1)}>{t("next")}</Link>}</div>
      </div>
    </>
  );
}

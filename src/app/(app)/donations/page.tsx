import Link from "next/link";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { can, canReadAudit } from "@/lib/permissions";
import { donationWhere, filterQs, parseDonationFilters } from "@/lib/donation-query";
import { fmtDate } from "@/lib/format";
import { inr, PAY_MODE_EN, PAY_MODE_GU } from "@/lib/money";

export const metadata = { title: "દાન રસીદ" };
const PAGE = 50;

export default async function DonationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePage("donations", "view");
  const t = await getT();
  const sp = await searchParams;
  const f = parseDonationFilters(sp);
  const page = Math.max(1, Number(sp.page) || 1);
  const where = donationWhere(f);
  const sa = canReadAudit(user.role);
  const [rows, count, sum, heads, users, byHead] = await Promise.all([
    db.donation.findMany({ where, orderBy: [{ date: "desc" }, { id: "desc" }], skip: (page - 1) * PAGE, take: PAGE, include: { head: true } }),
    db.donation.count({ where }),
    db.donation.aggregate({ where, _sum: { amount: true } }),
    db.accountHead.findMany({ where: { type: "INCOME" }, orderBy: { sortOrder: "asc" } }),
    sa ? db.user.findMany({ orderBy: { fullName: "asc" }, select: { id: true, fullName: true } }) : [],
    db.donation.groupBy({ by: ["headId"], where, _sum: { amount: true }, _count: { _all: true } }),
  ]);
  const qs = filterQs(f);
  const withPage = (p: number) => { const q = new URLSearchParams(qs); if (p > 1) q.set("page", String(p)); return `/donations?${q}`; };
  const modeLabel = (m: string) => (t.lang === "en" ? PAY_MODE_EN : PAY_MODE_GU)[m] ?? m;
  const headName = (id: number) => { const h = heads.find((x) => x.id === id); return h ? (t.lang === "en" ? h.nameEn ?? h.nameGu : h.nameGu) : "—"; };

  return (
    <>
      <div className="pagehead">
        <div><h1>{t.g("દાન રસીદ રજિસ્ટર", "Donation register")}</h1></div>
        <div className="btns">
          <a className="btn" href={`/export/donations?${qs}`}>Excel</a>
          {can(user.role, "donations", "create") && <Link className="btn pri" href="/donations/new">{t.g("+ નવી રસીદ", "+ New receipt")}</Link>}
        </div>
      </div>
      <form className="card" method="get">
        <div className="fields">
          <div className="field"><label htmlFor="from">{t("from_date")}</label><input id="from" name="from" type="date" defaultValue={f.from} /></div>
          <div className="field"><label htmlFor="to">{t("to_date")}</label><input id="to" name="to" type="date" defaultValue={f.to} /></div>
          <div className="field"><label htmlFor="head">{t.g("હેડ", "Head")}</label><select id="head" name="head" defaultValue={f.head ?? ""}><option value="">{t("all")}</option>{heads.map((h) => <option key={h.id} value={h.id}>{headName(h.id)}</option>)}</select></div>
          <div className="field"><label htmlFor="mode">{t.g("પેમેન્ટ", "Payment")}</label><select id="mode" name="mode" defaultValue={f.mode ?? ""}><option value="">{t("all")}</option>{["CASH", "UPI", "CHEQUE", "BANK"].map((m) => <option key={m} value={m}>{modeLabel(m)}</option>)}</select></div>
          <div className="field"><label htmlFor="status">{t("status")}</label><select id="status" name="status" defaultValue={f.status}><option value="ACTIVE">{t.g("ચાલુ", "Valid")}</option><option value="CANCELLED">{t.g("રદ", "Cancelled")}</option><option value="ALL">{t("all")}</option></select></div>
          {sa && <div className="field"><label htmlFor="user">{t.g("બનાવનાર", "Created by")}</label><select id="user" name="user" defaultValue={f.user ?? ""}><option value="">{t("all")}</option>{users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}</select></div>}
          <div className="field"><label htmlFor="q">{t("search")}</label><input id="q" name="q" type="search" defaultValue={f.q} placeholder={t.g("નામ, રસીદ નં., મોબાઈલ", "Name, receipt no., mobile")} /></div>
        </div>
        <div className="btns"><button className="btn pri" type="submit">{t("filter")}</button><Link className="btn" href="/donations">{t.g("આ વર્ષ", "This year")}</Link></div>
      </form>

      <div className="kpis">
        <div className="kpi"><span>{t.g("કુલ રકમ", "Total")}</span><b>{inr(sum._sum.amount)}</b></div>
        <div className="kpi"><span>{t.g("રસીદ", "Receipts")}</span><b>{count}</b></div>
        {byHead.sort((a, b) => Number(b._sum.amount) - Number(a._sum.amount)).slice(0, 3).map((h) => (
          <div className="kpi" key={h.headId}><span>{headName(h.headId)}</span><b>{inr(h._sum.amount)}</b></div>
        ))}
      </div>

      <div className="tablewrap">
        {rows.length ? (
          <table className="t">
            <thead><tr><th>{t.g("રસીદ નં.", "Receipt no.")}</th><th>{t.g("તારીખ", "Date")}</th><th>{t.g("દાતા", "Donor")}</th><th>{t.g("હેડ", "Head")}</th><th>{t.g("પેમેન્ટ", "Payment")}</th><th className="num">{t.g("રકમ", "Amount")}</th><th>{t.g("બનાવનાર", "Created by")}</th></tr></thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id} className={d.status === "CANCELLED" ? "dim" : undefined}>
                  <td className="nowrap"><Link href={`/donations/${d.id}`}>{d.receiptNo}</Link></td>
                  <td className="nowrap">{fmtDate(d.date)}</td>
                  <td>{d.donorName} {d.status === "CANCELLED" && <span className="chip bad">{t.g("રદ", "Cancelled")}</span>}</td>
                  <td>{headName(d.headId)}</td>
                  <td>{modeLabel(d.mode)}</td>
                  <td className="num">{inr(d.amount)}</td>
                  <td>{d.createdByName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p style={{ padding: 16 }} className="muted">{t("none_found")}</p>}
      </div>
      <div className="pager">
        <span>{t("showing", { from: count ? (page - 1) * PAGE + 1 : 0, to: Math.min(count, page * PAGE), total: count })}</span>
        <div className="btns">
          {page > 1 && <Link className="btn sm" href={withPage(page - 1)}>{t("prev")}</Link>}
          {page * PAGE < count && <Link className="btn sm" href={withPage(page + 1)}>{t("next")}</Link>}
        </div>
      </div>
    </>
  );
}

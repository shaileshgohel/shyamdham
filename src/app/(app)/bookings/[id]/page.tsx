import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { can, canReadAudit } from "@/lib/permissions";
import { activeAccounts, VOUCHER_TYPE_EN, VOUCHER_TYPE_GU } from "@/lib/accounts";
import { BOOKING_STATUS_EN, BOOKING_STATUS_GU, loadBooking, summarize } from "@/lib/bookings";
import { outstandingForBooking } from "@/lib/inventory";
import { getSettings } from "@/lib/settings";
import { fmtDate, todayIST } from "@/lib/format";
import { inr, PAY_MODE_EN, PAY_MODE_GU } from "@/lib/money";
import { BillDoc } from "@/components/bill-doc";
import { AuditTable } from "@/components/audit-table";
import { ChargePanel, DepositPanel, PaymentPanel, RemoveLine, StatusPanel } from "./panels";

export const metadata = { title: "બુકિંગ" };

export default async function BookingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const user = await requirePage("bookings", "view");
  const t = await getT();
  const b = await loadBooking(Number((await params).id) || 0);
  if (!b) notFound();
  const sp = await searchParams;
  const s = summarize(b);
  const [settings, accounts] = await Promise.all([getSettings(), activeAccounts()]);
  const logs = canReadAudit(user.role) ? await db.auditLog.findMany({ where: { entity: "booking", entityId: String(b.id) }, orderBy: { at: "desc" } }) : [];
  const canEdit = can(user.role, "bookings", "edit") && b.status !== "CANCELLED";
  const accts = accounts.map((a) => ({ id: a.id, name: a.name, kind: a.kind }));
  const out = outstandingForBooking(b.movements);
  const itemsOut = [...out.values()].reduce((n, q) => n + Math.max(0, q), 0);
  const today = todayIST();
  return (
    <>
      {sp.saved && <p className="alert ok" role="status">{sp.saved === "new" ? t.g(`બુકિંગ ${b.bookingNo} બની ગયું.`, `Booking ${b.bookingNo} created.`) : t("saved")}</p>}
      <div className="pagehead">
        <div><span className="muted">{b.bookingNo} · <span className="chip">{(t.lang === "en" ? BOOKING_STATUS_EN : BOOKING_STATUS_GU)[b.status]}</span></span><h1>{b.hirerName}</h1></div>
        <div className="btns">
          <Link className="btn" href="/bookings">{t("back")}</Link>
          <a className="btn pri" href={`/print/bill/${b.id}`} target="_blank" rel="noopener">{t.g("બિલ છાપો / PDF", "Print bill / PDF")}</a>
          {canEdit && <Link className="btn" href={`/bookings/${b.id}/edit`}>{t("edit")}</Link>}
          {canEdit && can(user.role, "inventory", "view") && <Link className="btn" href={`/bookings/${b.id}/items`}>{t.g(`વસ્તુ આપો / પરત (${itemsOut} બહાર)`, `Issue / return items (${itemsOut} out)`)}</Link>}
        </div>
      </div>
      <div className="kpis">
        <div className="kpi"><span>{t.g("કુલ બિલ", "Bill total")}</span><b>{inr(s.total)}</b></div>
        <div className="kpi"><span>{t.g("મળેલ", "Received")}</span><b>{inr(s.paid)}</b></div>
        <div className="kpi"><span>{t.g("બાકી", "Due")}</span><b className={s.balance > 0.001 ? "neg" : "pos"}>{inr(s.balance)}</b></div>
        <div className="kpi"><span>{t.g("ડિપોઝિટ પાસે", "Deposit held")}</span><b>{inr(s.depositHeld)}</b></div>
      </div>
      <div style={{ overflowX: "auto" }}><BillDoc b={b} settings={settings} /></div>

      {canEdit && b.lines.some((l) => l.kind === "DAMAGE" || l.kind === "MANUAL") && (
        <section className="card">
          <h2>{t.g("ઉમેરેલા ચાર્જ", "Added charges")}</h2>
          {b.lines.filter((l) => l.kind === "DAMAGE" || l.kind === "MANUAL").map((l) => <div key={l.id} className="btns"><span>{l.description} · {inr(l.amount)}</span><RemoveLine lineId={l.id} label={t("remove")} /></div>)}
        </section>
      )}

      {canEdit && (
        <div className="grid2">
          {(s.balance > 0.001 || s.depositAgreed - s.depositHeld > 0.001) && <PaymentPanel bookingId={b.id} accounts={accts} balance={s.balance} depositDue={Math.max(0, s.depositAgreed - s.depositHeld)} today={today} />}
          {s.depositHeld > 0.001 && <DepositPanel bookingId={b.id} accounts={accts} held={s.depositHeld} balance={s.balance} today={today} />}
          <ChargePanel bookingId={b.id} />
        </div>
      )}

      {b.vouchers.length > 0 && (
        <section className="card">
          <h2>{t.g("પેમેન્ટ અને ડિપોઝિટની એન્ટ્રી", "Payment and deposit entries")}</h2>
          <div className="tablewrap">
            <table className="t">
              <thead><tr><th>{t.g("નંબર", "No.")}</th><th>{t.g("તારીખ", "Date")}</th><th>{t("type")}</th><th>{t.g("ખાતું", "Account")}</th><th className="num">{t.g("રકમ", "Amount")}</th><th>{t.g("બનાવનાર", "By")}</th></tr></thead>
              <tbody>{b.vouchers.map((v) => <tr key={v.id} className={v.status === "CANCELLED" ? "dim" : undefined}><td><Link href={`/accounts/vouchers/${v.id}`}>{v.voucherNo}</Link></td><td>{fmtDate(v.date)}</td><td>{(t.lang === "en" ? VOUCHER_TYPE_EN : VOUCHER_TYPE_GU)[v.type]}{v.head ? ` · ${v.head.nameGu}` : ""}</td><td>{v.account.name} · {(t.lang === "en" ? PAY_MODE_EN : PAY_MODE_GU)[v.mode]}</td><td className="num">{inr(v.amount)}</td><td>{v.createdByName}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      )}

      {can(user.role, "bookings", "edit") && <StatusPanel bookingId={b.id} status={b.status} canCancel={can(user.role, "bookings", "cancel")} />}
      {logs.length > 0 && <section className="card"><h2>{t("history")}</h2><AuditTable rows={logs} t={t} compact /></section>}
    </>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { can, canReadAudit } from "@/lib/permissions";
import { VOUCHER_TYPE_EN, VOUCHER_TYPE_GU } from "@/lib/accounts";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { inr, PAY_MODE_EN, PAY_MODE_GU, rupeesInGujarati, num } from "@/lib/money";
import { CancelForm } from "@/components/cancel-form";
import { AuditTable } from "@/components/audit-table";
import { cancelVoucherAction } from "../../actions";

export const metadata = { title: "વાઉચર" };

export default async function VoucherPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string }> }) {
  const user = await requirePage("accounts", "view");
  const t = await getT();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const v = await db.voucher.findUnique({ where: { id }, include: { head: true, account: true, toAccount: true, booking: true, donation: true } });
  if (!v) notFound();
  const sp = await searchParams;
  const logs = canReadAudit(user.role) ? await db.auditLog.findMany({ where: { entity: "voucher", entityId: String(id) }, orderBy: { at: "desc" } }) : [];
  const typeLabel = (t.lang === "en" ? VOUCHER_TYPE_EN : VOUCHER_TYPE_GU)[v.type];
  return (
    <>
      {sp.new && <p className="alert ok" role="status">{t.g(`વાઉચર ${v.voucherNo} સેવ થયું.`, `Voucher ${v.voucherNo} saved.`)}</p>}
      <div className="pagehead">
        <div><span className="muted">{typeLabel}</span><h1>{v.voucherNo} {v.status === "CANCELLED" && <span className="chip bad">{t.g("રદ", "Cancelled")}</span>}</h1></div>
        <div className="btns"><Link className="btn" href="/accounts/vouchers">{t("back")}</Link></div>
      </div>
      <section className="card">
        <dl className="kv">
          <dt>{t.g("તારીખ", "Date")}</dt><dd>{fmtDate(v.date)}</dd>
          <dt>{t.g("રકમ", "Amount")}</dt><dd><b>{inr(v.amount)}</b> <span className="muted small">({rupeesInGujarati(num(v.amount))} પૂરા)</span></dd>
          {v.head && <><dt>{t.g("હેડ", "Head")}</dt><dd>{v.head.nameGu}</dd></>}
          <dt>{t.g("ખાતું", "Account")}</dt><dd>{v.account.name}{v.toAccount ? ` → ${v.toAccount.name}` : ""}</dd>
          <dt>{t.g("પેમેન્ટ", "Payment")}</dt><dd>{(t.lang === "en" ? PAY_MODE_EN : PAY_MODE_GU)[v.mode] ?? v.mode}{v.reference ? ` · ${v.reference}` : ""}</dd>
          {v.party && <><dt>{v.type === "EXPENSE" || v.type === "DEPOSIT_OUT" ? t.g("કોને", "Paid to") : t.g("કોની પાસેથી", "From")}</dt><dd>{v.party}</dd></>}
          {v.narration && <><dt>{t.g("વિગત", "Details")}</dt><dd>{v.narration}</dd></>}
          {v.donation && <><dt>{t.g("દાન રસીદ", "Receipt")}</dt><dd><Link href={`/donations/${v.donation.id}`}>{v.donation.receiptNo}</Link></dd></>}
          {v.booking && <><dt>{t.g("બુકિંગ", "Booking")}</dt><dd><Link href={`/bookings/${v.booking.id}`}>{v.booking.bookingNo} · {v.booking.hirerName}</Link></dd></>}
          <dt>{t.g("બનાવનાર", "Entered by")}</dt><dd>{v.createdByName} · {fmtDateTime(v.createdAt)}</dd>
          {v.status === "CANCELLED" && <><dt>{t.g("રદ કારણ", "Cancel reason")}</dt><dd className="neg">{v.cancelReason} · {fmtDateTime(v.cancelledAt)}</dd></>}
        </dl>
        {v.attachment && (
          <div>
            {v.attachmentType?.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <a href={`/attachment/${v.id}`} target="_blank" rel="noopener"><img src={`/attachment/${v.id}`} alt={t.g("બિલનો ફોટો", "Bill photo")} style={{ maxWidth: 360, border: "1px solid var(--line)", borderRadius: 6 }} /></a>
            ) : <a className="btn" href={`/attachment/${v.id}`} target="_blank" rel="noopener">📎 {v.attachmentName}</a>}
          </div>
        )}
      </section>
      {v.status === "ACTIVE" && v.source === "MANUAL" && can(user.role, "accounts", "cancel") && (
        <CancelForm action={cancelVoucherAction} id={v.id} buttonLabel={t.g("વાઉચર રદ કરો", "Cancel voucher")} reasonLabel={t("reason")} confirmLabel={t("confirm")} />
      )}
      {logs.length > 0 && <section className="card"><h2>{t("history")}</h2><AuditTable rows={logs} t={t} compact /></section>}
    </>
  );
}

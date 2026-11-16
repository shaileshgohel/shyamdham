import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { can, canReadAudit } from "@/lib/permissions";
import { getSettings } from "@/lib/settings";
import { siteUrl } from "@/lib/site";
import { ReceiptDoc } from "@/components/receipt-doc";
import { AuditTable } from "@/components/audit-table";
import { cancelDonationAction } from "../actions";
import { CancelForm } from "@/components/cancel-form";

export const metadata = { title: "દાન રસીદ" };

export default async function DonationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string }> }) {
  const user = await requirePage("donations", "view");
  const t = await getT();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const d = await db.donation.findUnique({ where: { id }, include: { head: true } });
  if (!d) notFound();
  const sp = await searchParams;
  const [settings, base] = await Promise.all([getSettings(), siteUrl()]);
  const logs = canReadAudit(user.role) ? await db.auditLog.findMany({ where: { entity: "donation", entityId: String(id) }, orderBy: { at: "desc" } }) : [];
  return (
    <>
      {sp.new && <p className="alert ok" role="status">{t.g(`રસીદ ${d.receiptNo} બની ગઈ.`, `Receipt ${d.receiptNo} created.`)}</p>}
      <div className="pagehead">
        <div><span className="muted">{d.receiptNo}</span><h1>{d.donorName}</h1></div>
        <div className="btns">
          <Link className="btn" href="/donations">{t("back")}</Link>
          <a className="btn pri" href={`/print/receipt/${d.id}`} target="_blank" rel="noopener">{t.g("રસીદ છાપો / PDF", "Print / PDF")}</a>
          {can(user.role, "donations", "create") && <Link className="btn" href="/donations/new">{t.g("+ નવી રસીદ", "+ New receipt")}</Link>}
        </div>
      </div>
      <div style={{ overflowX: "auto" }}><ReceiptDoc d={d} head={d.head} settings={settings} verifyUrl={`${base}/verify/${d.verifyCode}`} /></div>
      {d.status === "ACTIVE" && can(user.role, "donations", "cancel") && (
        <CancelForm action={cancelDonationAction} id={d.id} buttonLabel={t.g("રસીદ રદ કરો", "Cancel receipt")} reasonLabel={t("reason")} confirmLabel={t("confirm")}
          intro={t.g("રદ થયેલી રસીદ અને તેની રકમ હિસાબમાંથી નીકળી જશે, પણ રસીદ નંબર અને ઇતિહાસ સચવાઈ રહેશે.", "The receipt and its amount are removed from the accounts, but the number and history are kept.")} />
      )}
      {logs.length > 0 && <section className="card"><h2>{t("history")}</h2><AuditTable rows={logs} t={t} compact /></section>}
    </>
  );
}

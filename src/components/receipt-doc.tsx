import QRCode from "qrcode";
import type { Donation, AccountHead } from "@prisma/client";
import { fmtDate, fmtDateTime, fmtMobile } from "@/lib/format";
import { inr, num, PAY_MODE_GU, rupeesInGujarati } from "@/lib/money";
import type { Settings } from "@/lib/settings";

/** The donation receipt as donors see it. Gujarati only, like the paper receipt book. */
export async function ReceiptDoc({ d, head, settings, verifyUrl }: { d: Donation; head: AccountHead; settings: Settings; verifyUrl: string }) {
  const qr = await QRCode.toString(verifyUrl, { type: "svg", margin: 0, width: 96, errorCorrectionLevel: "M" });
  const amount = num(d.amount);
  return (
    <div className="doc-page" data-testid="receipt">
      <div className="doc-head">
        <b>{settings.trust_name}</b>
        <span>{settings.trust_sub}</span>
        <span style={{ fontSize: 12 }}>{[settings.address, settings.phone && `ફોન: ${settings.phone}`].filter(Boolean).join(" · ")}</span>
        {(settings.reg_no || settings.pan) && <span style={{ fontSize: 12 }}>{[settings.reg_no && `રજી. નં. ${settings.reg_no}`, settings.pan && `PAN: ${settings.pan}`].filter(Boolean).join(" · ")}</span>}
      </div>
      <p className="doc-title">દાન રસીદ</p>
      <div className="doc-meta"><span>રસીદ નં. {d.receiptNo}</span><span>તા. {fmtDate(d.date)}</span></div>
      {d.status === "CANCELLED" && <p style={{ textAlign: "center" }}><span className="stamp-cancel">રદ · CANCELLED</span><br /><span className="small">કારણ: {d.cancelReason}</span></p>}
      <dl className="doc-lines">
        <dt>શ્રી</dt><dd><b>{d.donorName}</b></dd>
        {d.address && <><dt>સરનામું</dt><dd>{d.address}</dd></>}
        {d.mobile && <><dt>મોબાઈલ</dt><dd>{fmtMobile(d.mobile)}</dd></>}
        {d.pan && <><dt>PAN</dt><dd>{d.pan}</dd></>}
        <dt>હેડ</dt><dd>{head.nameGu}</dd>
        <dt>અંકે રૂપિયા</dt><dd>{rupeesInGujarati(amount)} પૂરા</dd>
        <dt>પેમેન્ટ</dt><dd>{PAY_MODE_GU[d.mode] ?? d.mode}{d.reference ? ` · ${d.reference}` : ""}</dd>
        {d.inMemoryOf && <><dt>સ્મરણાર્થે</dt><dd>{d.inMemoryOf}</dd></>}
      </dl>
      <div className="doc-amount">
        <span className="box">{inr(amount)}/-</span>
        <div style={{ textAlign: "center", fontSize: 10 }}>
          <div style={{ width: 96, height: 96 }} dangerouslySetInnerHTML={{ __html: qr }} />
          ખરાઈ માટે સ્કેન કરો
        </div>
      </div>
      {settings.g80_text && <p style={{ fontSize: 12, marginTop: 12 }}>{settings.g80_text}</p>}
      <p style={{ marginTop: 10 }}>{settings.receipt_footer}</p>
      <div className="doc-foot">
        <span>બનાવનાર: {d.createdByName} · {fmtDateTime(d.createdAt)}</span>
        <span style={{ borderTop: "1px solid #444", paddingTop: 4, minWidth: 160, textAlign: "center" }}>સ્વીકારનારની સહી</span>
      </div>
    </div>
  );
}

import type { Prisma } from "@prisma/client";
import { fmtDate, fmtDateTime, fmtMobile } from "@/lib/format";
import { inr, num, PAY_MODE_GU, rupeesInGujarati } from "@/lib/money";
import { SLOT_GU, summarize } from "@/lib/bookings";
import type { Settings } from "@/lib/settings";

type B = Prisma.BookingGetPayload<{ include: { facilities: { include: { facility: true } }; lines: true; vouchers: true } }>;

/** The wadi rent bill as the hirer sees it. Gujarati only, like the paper bill. */
export function BillDoc({ b, settings }: { b: B; settings: Settings }) {
  const s = summarize(b);
  const pays = b.vouchers.filter((v) => v.status === "ACTIVE");
  return (
    <div className="doc-page" data-testid="bill">
      <div className="doc-head">
        <b>{settings.trust_name}</b>
        <span>{settings.trust_sub}</span>
        <span style={{ fontSize: 12 }}>{[settings.address, settings.phone && `ફોન: ${settings.phone}`].filter(Boolean).join(" · ")}</span>
      </div>
      <p className="doc-title">વાડી ભાડા બિલ</p>
      <div className="doc-meta"><span>બિલ નં. {b.bookingNo}</span><span>તા. {fmtDate(b.createdAt)}</span></div>
      {b.status === "CANCELLED" && <p style={{ textAlign: "center" }}><span className="stamp-cancel">રદ · CANCELLED</span><br /><span className="small">કારણ: {b.cancelReason}</span></p>}
      <dl className="doc-lines">
        <dt>શ્રી</dt><dd><b>{b.hirerName}</b>{b.isMember ? " (જ્ઞાતિ સભ્ય)" : ""}</dd>
        {b.mobile && <><dt>મોબાઈલ</dt><dd>{fmtMobile(b.mobile)}</dd></>}
        <dt>પ્રસંગ</dt><dd>{b.eventType}{b.guests ? ` · અંદાજે ${b.guests} મહેમાન` : ""}</dd>
        <dt>તારીખ</dt><dd>{fmtDate(b.fromDate)}{b.toDate.getTime() !== b.fromDate.getTime() ? ` થી ${fmtDate(b.toDate)}` : ""} · {SLOT_GU[b.slot]}</dd>
        <dt>સુવિધા</dt><dd>{b.facilities.map((f) => f.facility.nameGu).join(", ")}</dd>
      </dl>
      <table>
        <thead><tr><th>વિગત</th><th className="num">જથ્થો</th><th className="num">દર</th><th className="num">રકમ ₹</th></tr></thead>
        <tbody>
          {b.lines.map((l) => <tr key={l.id}><td>{l.description}</td><td className="num">{num(l.qty)}</td><td className="num">{inr(l.rate, { symbol: false })}</td><td className="num">{inr(l.amount, { symbol: false })}</td></tr>)}
          <tr><td colSpan={3}><b>કુલ બિલ</b></td><td className="num"><b>{inr(s.total, { symbol: false })}</b></td></tr>
          {pays.filter((v) => v.type === "INCOME").map((v) => <tr key={v.id}><td colSpan={3}>મળેલ: {fmtDate(v.date)} · {PAY_MODE_GU[v.mode] ?? v.mode} · {v.voucherNo}</td><td className="num">− {inr(v.amount, { symbol: false })}</td></tr>)}
          <tr><td colSpan={3}><b>{s.balance > 0.001 ? "બાકી રકમ" : "બાકી"}</b></td><td className="num"><b>{inr(Math.max(0, s.balance), { symbol: false })}</b></td></tr>
        </tbody>
      </table>
      <p style={{ marginTop: 8 }}>અંકે રૂપિયા: {rupeesInGujarati(s.total)} પૂરા</p>
      {(s.depositAgreed > 0 || s.depositReceived > 0) && (
        <table>
          <tbody>
            <tr><td>ડિપોઝિટ (પરત મળવાપાત્ર)</td><td className="num">{inr(s.depositAgreed, { symbol: false })}</td></tr>
            {pays.filter((v) => v.type === "DEPOSIT_IN" || v.type === "DEPOSIT_OUT").map((v) => <tr key={v.id}><td>{v.type === "DEPOSIT_IN" ? "ડિપોઝિટ મળી" : v.mode === "ADJUST" ? "ડિપોઝિટમાંથી બિલમાં સરભર" : "ડિપોઝિટ પરત"} · {fmtDate(v.date)} · {v.voucherNo}</td><td className="num">{v.type === "DEPOSIT_IN" ? "" : "− "}{inr(v.amount, { symbol: false })}</td></tr>)}
            <tr><td><b>ડિપોઝિટ સંસ્થા પાસે</b></td><td className="num"><b>{inr(s.depositHeld, { symbol: false })}</b></td></tr>
          </tbody>
        </table>
      )}
      {settings.bill_terms && <p style={{ fontSize: 12, marginTop: 12 }}>{settings.bill_terms}</p>}
      <div className="doc-foot">
        <span>બનાવનાર: {b.createdByName} · {fmtDateTime(b.createdAt)}</span>
        <span style={{ borderTop: "1px solid #444", paddingTop: 4, minWidth: 160, textAlign: "center" }}>વ્યવસ્થાપકની સહી</span>
      </div>
    </div>
  );
}

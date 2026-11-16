import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { fmtDate } from "@/lib/format";
import { inr } from "@/lib/money";

export const metadata = { title: "રસીદ ખરાઈ", robots: { index: false } };

// Public page behind the receipt's QR code. Shows only what is printed on the receipt itself.
export default async function VerifyPage({ params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.slice(0, 40);
  const [d, s] = await Promise.all([db.donation.findUnique({ where: { verifyCode: code }, include: { head: true } }), getSettings()]);
  const masked = d ? d.donorName.split(/\s+/).map((w, i, a) => (i === 0 || i === a.length - 1 ? w : `${w.charAt(0)}.`)).join(" ") : "";
  return (
    <main className="login-wrap">
      <div className="login-card">
        <div className="brand"><b>{s.trust_name}</b><span>{s.trust_sub}</span></div>
        {!d ? (
          <p className="alert bad">આ રસીદ મળી નથી. · Receipt not found.</p>
        ) : (
          <>
            <p className={`alert ${d.status === "ACTIVE" ? "ok" : "bad"}`} role="status">
              {d.status === "ACTIVE" ? "✓ આ રસીદ સાચી છે. · This receipt is genuine." : "✗ આ રસીદ રદ થયેલી છે. · This receipt was cancelled."}
            </p>
            <dl className="kv">
              <dt>રસીદ નં.</dt><dd>{d.receiptNo}</dd>
              <dt>તારીખ</dt><dd>{fmtDate(d.date)}</dd>
              <dt>દાતા</dt><dd>{masked}</dd>
              <dt>હેડ</dt><dd>{d.head.nameGu}</dd>
              <dt>રકમ</dt><dd><b>{inr(d.amount)}</b></dd>
            </dl>
          </>
        )}
      </div>
    </main>
  );
}

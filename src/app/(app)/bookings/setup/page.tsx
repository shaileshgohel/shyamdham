import Link from "next/link";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { ChargeForm, FacilityForm } from "./forms";

export const metadata = { title: "સુવિધા અને દર" };

export default async function BookingSetupPage() {
  await requirePage("bookings", "edit");
  const t = await getT();
  const [facilities, charges] = await Promise.all([db.facility.findMany({ orderBy: { sortOrder: "asc" } }), db.chargeItem.findMany({ orderBy: { sortOrder: "asc" } })]);
  return (
    <>
      <div className="pagehead">
        <div><h1>{t.g("સુવિધા અને રેટ કાર્ડ", "Facilities and rate card")}</h1><p className="muted small" style={{ maxWidth: 720 }}>{t.g("શરૂઆતના દર નમૂના છે; સમિતિ નક્કી કરે તે દર લખો. નવા દર ફક્ત નવા કે સુધારેલા બુકિંગ પર લાગશે.", "The starting rates are examples; enter the rates the committee decides. New rates apply only to new or edited bookings.")}</p></div>
        <Link className="btn" href="/bookings">{t("back")}</Link>
      </div>
      <section className="card">
        <h2>{t.g("સુવિધા (દર પ્રતિ દિવસ)", "Facilities (rate per day)")}</h2>
        {facilities.map((f) => <FacilityForm key={f.id} f={{ id: f.id, nameGu: f.nameGu, memberRate: Number(f.memberRate), nonMemberRate: Number(f.nonMemberRate), deposit: Number(f.deposit), isActive: f.isActive }} />)}
        <hr style={{ border: 0, borderTop: "1px solid var(--line)", width: "100%" }} />
        <FacilityForm />
      </section>
      <section className="card">
        <h2>{t.g("વધારાની વસ્તુ / સેવા", "Extras")}</h2>
        {charges.map((c) => <ChargeForm key={c.id} c={{ id: c.id, nameGu: c.nameGu, unit: c.unit, rate: Number(c.rate), isActive: c.isActive }} />)}
        <hr style={{ border: 0, borderTop: "1px solid var(--line)", width: "100%" }} />
        <ChargeForm />
      </section>
    </>
  );
}

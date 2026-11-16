"use client";
import { useMemo, useState } from "react";
import { ActionForm, Submit } from "@/components/action-form";
import { MemberPicker } from "@/components/member-picker";
import { useG } from "@/components/i18n-client";
import { saveBookingAction } from "./actions";

type Fac = { id: number; name: string; memberRate: number; nonMemberRate: number; deposit: number };
type Charge = { id: number; name: string; unit: string; rate: number };
export type BookingValue = {
  id?: number; hirerName: string; familyId: number | null; mobile: string; address: string; isMember: boolean; eventType: string;
  fromDate: string; toDate: string; slot: string; guests: string; notes: string; facilityIds: number[]; extras: Record<number, number>;
  discount: string; discountNote: string; depositAmount: string; extraLines: number;
};

const money = (n: number) => `₹ ${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export function BookingForm({ v, facilities, charges, events, today }: { v: BookingValue; facilities: Fac[]; charges: Charge[]; events: string[]; today: string }) {
  const g = useG();
  const [member, setMember] = useState(v.isMember);
  const [familyId, setFamilyId] = useState(v.familyId);
  const [mobile, setMobile] = useState(v.mobile);
  const [address, setAddress] = useState(v.address);
  const [from, setFrom] = useState(v.fromDate);
  const [to, setTo] = useState(v.toDate);
  const [fac, setFac] = useState<number[]>(v.facilityIds);
  const [extras, setExtras] = useState<Record<number, number>>(v.extras);
  const [discount, setDiscount] = useState(v.discount);
  const [deposit, setDeposit] = useState(v.depositAmount);
  const isMember = member || !!familyId;

  const days = useMemo(() => {
    if (!from) return 1;
    const a = new Date(`${from}T00:00:00Z`).getTime(), b = new Date(`${(to || from)}T00:00:00Z`).getTime();
    return Math.max(1, Math.round((b - a) / 86400000) + 1);
  }, [from, to]);
  const chosen = facilities.filter((f) => fac.includes(f.id));
  const rent = chosen.reduce((n, f) => n + (isMember ? f.memberRate : f.nonMemberRate) * days, 0);
  const extra = charges.reduce((n, c) => n + (extras[c.id] || 0) * c.rate, 0);
  const disc = Number(discount.replace(/,/g, "")) || 0;
  const autoDeposit = chosen.reduce((n, f) => n + f.deposit, 0);

  return (
    <ActionForm action={saveBookingAction}>
      {(_s, pending) => (
        <>
          {v.id && <input type="hidden" name="id" value={v.id} />}
          <section className="card">
            <h2>{g("બુકિંગ કરનાર", "Hirer")}</h2>
            <div className="fields">
              <MemberPicker nameField="hirerName" label={g("નામ", "Name")} defaultName={v.hirerName} defaultFamilyId={v.familyId} onPick={(m) => { setFamilyId(m?.familyId ?? null); if (m) { setMobile(m.mobile ?? ""); setAddress(m.address ?? ""); } }} />
              <div className="field"><label htmlFor="mobile">{g("મોબાઈલ (WhatsApp)", "Mobile (WhatsApp)")}</label><input id="mobile" name="mobile" type="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} /></div>
              <div className="field wide"><label htmlFor="address">{g("સરનામું", "Address")}</label><input id="address" name="address" type="text" value={address} onChange={(e) => setAddress(e.target.value)} /></div>
              <div className="field"><label>&nbsp;</label><label className="check"><input type="checkbox" name="isMember" checked={isMember} disabled={!!familyId} onChange={(e) => setMember(e.target.checked)} /> {g("જ્ઞાતિ સભ્ય (સભ્ય દર)", "Community member (member rate)")}</label></div>
            </div>
          </section>
          <section className="card">
            <h2>{g("પ્રસંગ અને તારીખ", "Event and dates")}</h2>
            <div className="fields">
              <div className="field"><label htmlFor="eventType">{g("પ્રસંગ", "Event")}</label><select id="eventType" name="eventType" defaultValue={v.eventType}>{events.map((e) => <option key={e}>{e}</option>)}</select></div>
              <div className="field"><label htmlFor="fromDate">{g("તારીખથી", "From")} <span className="req">*</span></label><input id="fromDate" name="fromDate" type="date" value={from} min={v.id ? undefined : today} onChange={(e) => { setFrom(e.target.value); if (!to || to < e.target.value) setTo(e.target.value); }} required /></div>
              <div className="field"><label htmlFor="toDate">{g("તારીખ સુધી", "To")}</label><input id="toDate" name="toDate" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></div>
              <div className="field"><label htmlFor="slot">{g("સમય", "Slot")}</label><select id="slot" name="slot" defaultValue={v.slot}><option value="FULL">{g("આખો દિવસ", "Full day")}</option><option value="MORNING">{g("સવાર", "Morning")}</option><option value="EVENING">{g("સાંજ", "Evening")}</option></select></div>
              <div className="field"><label htmlFor="guests">{g("અંદાજે મહેમાન", "Approx. guests")}</label><input id="guests" name="guests" type="text" inputMode="numeric" defaultValue={v.guests} /></div>
              <div className="field wide"><label htmlFor="notes">{g("નોંધ", "Notes")}</label><input id="notes" name="notes" type="text" defaultValue={v.notes} /></div>
            </div>
          </section>
          <section className="card">
            <h2>{g("સુવિધા", "Facilities")}</h2>
            <div className="fields">
              {facilities.map((f) => (
                <label key={f.id} className="check card" style={{ padding: 10, gap: 10 }}>
                  <input type="checkbox" name="facilityId" value={f.id} checked={fac.includes(f.id)} onChange={(e) => setFac((x) => (e.target.checked ? [...x, f.id] : x.filter((y) => y !== f.id)))} />
                  <span><b>{f.name}</b><br /><span className="small muted">{money(isMember ? f.memberRate : f.nonMemberRate)} / {g("દિવસ", "day")} · {g("ડિપોઝિટ", "deposit")} {money(f.deposit)}</span></span>
                </label>
              ))}
            </div>
          </section>
          <section className="card">
            <h2>{g("વધારાની વસ્તુ / સેવા", "Extras")}</h2>
            <div className="fields">
              {charges.map((c) => (
                <div key={c.id} className="field">
                  <label htmlFor={`extra.${c.id}`}>{c.name} · {money(c.rate)}/{c.unit}</label>
                  <input id={`extra.${c.id}`} name={`extra.${c.id}`} type="text" inputMode="numeric" placeholder="0" value={extras[c.id] ? String(extras[c.id]) : ""} onChange={(e) => setExtras((x) => ({ ...x, [c.id]: Number(e.target.value) || 0 }))} />
                </div>
              ))}
              <div className="field"><label htmlFor="discount">{g("ડિસ્કાઉન્ટ ₹", "Discount ₹")}</label><input id="discount" name="discount" type="text" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} /></div>
              <div className="field"><label htmlFor="discountNote">{g("ડિસ્કાઉન્ટનું કારણ", "Discount reason")}</label><input id="discountNote" name="discountNote" type="text" defaultValue={v.discountNote} /></div>
              <div className="field"><label htmlFor="depositAmount">{g("ડિપોઝિટ ₹", "Deposit ₹")}</label><input id="depositAmount" name="depositAmount" type="text" inputMode="decimal" placeholder={String(autoDeposit)} value={deposit} onChange={(e) => setDeposit(e.target.value)} /><span className="help">{g("ખાલી રાખો તો સુવિધા પ્રમાણે", "Leave empty to use the facility deposit")}</span></div>
            </div>
          </section>
          <section className="card" aria-live="polite">
            <h2>{g("બિલનો અંદાજ", "Bill estimate")}</h2>
            <dl className="kv">
              <dt>{g("ભાડું", "Rent")}</dt><dd>{money(rent)} <span className="muted small">({days} {g("દિવસ", "day(s)")} · {isMember ? g("સભ્ય દર", "member rate") : g("બિન-સભ્ય દર", "non-member rate")})</span></dd>
              <dt>{g("વધારાનું", "Extras")}</dt><dd>{money(extra)}</dd>
              {disc > 0 && <><dt>{g("ડિસ્કાઉન્ટ", "Discount")}</dt><dd>− {money(disc)}</dd></>}
              <dt><b>{g("કુલ બિલ", "Total bill")}</b></dt><dd><b data-testid="bill-total">{money(Math.max(0, rent + extra - disc))}</b>{v.extraLines > 0 ? <span className="muted small"> + {g("નુકસાન / વધારાની લાઇન", "damage / extra lines")}</span> : null}</dd>
              <dt>{g("ડિપોઝિટ (પરત મળશે)", "Deposit (refundable)")}</dt><dd>{money(deposit ? Number(deposit.replace(/,/g, "")) || 0 : autoDeposit)}</dd>
            </dl>
          </section>
          <div className="btns"><Submit pending={pending}>{g("બુકિંગ સેવ કરો", "Save booking")}</Submit></div>
        </>
      )}
    </ActionForm>
  );
}

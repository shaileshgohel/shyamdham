"use client";
import { useState } from "react";
import { ActionForm, Submit } from "@/components/action-form";
import { MoneyFields, type AccountOpt } from "@/components/money-fields";
import { MemberPicker } from "@/components/member-picker";
import { useG } from "@/components/i18n-client";
import { createDonationAction } from "./actions";

export function DonationForm({ heads, accounts, defaultHeadId, today, mayBackdate }: { heads: { id: number; name: string }[]; accounts: AccountOpt[]; defaultHeadId?: number; today: string; mayBackdate: boolean }) {
  const g = useG();
  const [mobile, setMobile] = useState("");
  const [address, setAddress] = useState("");
  const [pan, setPan] = useState("");
  return (
    <ActionForm action={createDonationAction} className="form">
      {(_s, pending) => (
        <>
          <section className="card">
            <h2>{g("દાતા", "Donor")}</h2>
            <div className="fields">
              <MemberPicker nameField="donorName" label={g("દાતાનું નામ", "Donor name")} onPick={(m) => { if (m) { setMobile(m.mobile ?? ""); setAddress(m.address ?? ""); setPan(m.pan ?? ""); } }} />
              <div className="field"><label htmlFor="mobile">{g("મોબાઈલ (WhatsApp)", "Mobile (WhatsApp)")}</label><input id="mobile" name="mobile" type="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} /></div>
              <div className="field"><label htmlFor="pan">{g("PAN (80G માટે)", "PAN (for 80G)")}</label><input id="pan" name="pan" type="text" value={pan} onChange={(e) => setPan(e.target.value.toUpperCase())} /></div>
              <div className="field wide"><label htmlFor="address">{g("સરનામું", "Address")}</label><input id="address" name="address" type="text" value={address} onChange={(e) => setAddress(e.target.value)} /></div>
            </div>
          </section>
          <section className="card">
            <h2>{g("દાનની વિગત", "Donation")}</h2>
            <div className="fields">
              <div className="field"><label htmlFor="amount">{g("રકમ ₹", "Amount ₹")} <span className="req">*</span></label><input id="amount" name="amount" type="text" inputMode="decimal" required /></div>
              <div className="field"><label htmlFor="headId">{g("હેડ", "Head")}</label>
                <select id="headId" name="headId" defaultValue={defaultHeadId}>{heads.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select>
              </div>
              <div className="field"><label htmlFor="date">{g("તારીખ", "Date")}</label><input id="date" name="date" type="date" defaultValue={today} max={today} readOnly={!mayBackdate} /></div>
              <MoneyFields accounts={accounts} />
              <div className="field"><label htmlFor="inMemoryOf">{g("સ્મરણાર્થે (વૈકલ્પિક)", "In memory of (optional)")}</label><input id="inMemoryOf" name="inMemoryOf" type="text" /></div>
              <div className="field wide"><label htmlFor="notes">{g("નોંધ", "Notes")}</label><input id="notes" name="notes" type="text" /></div>
            </div>
          </section>
          <p className="small muted">{g("સેવ કર્યા પછી રસીદ સુધારી શકાતી નથી; ભૂલ હોય તો રદ કરીને નવી બનાવો.", "A saved receipt cannot be edited; if it is wrong, cancel it and make a new one.")}</p>
          <div className="btns"><Submit pending={pending}>{g("સેવ કરો અને રસીદ જુઓ", "Save and view receipt")}</Submit></div>
        </>
      )}
    </ActionForm>
  );
}

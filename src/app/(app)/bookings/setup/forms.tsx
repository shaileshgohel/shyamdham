"use client";
import { ActionForm, Submit } from "@/components/action-form";
import { useG } from "@/components/i18n-client";
import { saveChargeItemAction, saveFacilityAction } from "../actions";

export function FacilityForm({ f }: { f?: { id: number; nameGu: string; memberRate: number; nonMemberRate: number; deposit: number; isActive: boolean } }) {
  const g = useG();
  return (
    <ActionForm action={saveFacilityAction} className="btns" resetOnSuccess={!f}>
      {(_s, pending) => (
        <>
          {f && <input type="hidden" name="id" value={f.id} />}
          <input name="nameGu" type="text" defaultValue={f?.nameGu} placeholder={g("સુવિધાનું નામ", "Facility name")} aria-label={g("નામ", "Name")} required style={{ flex: 2, minWidth: 140 }} />
          <label className="small">{g("સભ્ય ₹", "Member ₹")}<input name="memberRate" type="text" inputMode="decimal" defaultValue={f?.memberRate ?? ""} style={{ width: 100 }} /></label>
          <label className="small">{g("બિન-સભ્ય ₹", "Non-member ₹")}<input name="nonMemberRate" type="text" inputMode="decimal" defaultValue={f?.nonMemberRate ?? ""} style={{ width: 100 }} /></label>
          <label className="small">{g("ડિપોઝિટ ₹", "Deposit ₹")}<input name="deposit" type="text" inputMode="decimal" defaultValue={f?.deposit ?? ""} style={{ width: 100 }} /></label>
          {f && <select name="isActive" defaultValue={f.isActive ? "1" : "0"} aria-label={g("સ્થિતિ", "Status")} style={{ width: "auto" }}><option value="1">{g("ચાલુ", "Active")}</option><option value="0">{g("બંધ", "Off")}</option></select>}
          <Submit pending={pending} className="btn sm">{f ? g("સેવ", "Save") : g("+ ઉમેરો", "+ Add")}</Submit>
        </>
      )}
    </ActionForm>
  );
}

export function ChargeForm({ c }: { c?: { id: number; nameGu: string; unit: string; rate: number; isActive: boolean } }) {
  const g = useG();
  return (
    <ActionForm action={saveChargeItemAction} className="btns" resetOnSuccess={!c}>
      {(_s, pending) => (
        <>
          {c && <input type="hidden" name="id" value={c.id} />}
          <input name="nameGu" type="text" defaultValue={c?.nameGu} placeholder={g("વસ્તુ / સેવા", "Item / service")} aria-label={g("નામ", "Name")} required style={{ flex: 2, minWidth: 140 }} />
          <label className="small">{g("એકમ", "Unit")}<input name="unit" type="text" defaultValue={c?.unit ?? "નંગ"} style={{ width: 80 }} /></label>
          <label className="small">{g("દર ₹", "Rate ₹")}<input name="rate" type="text" inputMode="decimal" defaultValue={c?.rate ?? ""} style={{ width: 100 }} /></label>
          {c && <select name="isActive" defaultValue={c.isActive ? "1" : "0"} aria-label={g("સ્થિતિ", "Status")} style={{ width: "auto" }}><option value="1">{g("ચાલુ", "Active")}</option><option value="0">{g("બંધ", "Off")}</option></select>}
          <Submit pending={pending} className="btn sm">{c ? g("સેવ", "Save") : g("+ ઉમેરો", "+ Add")}</Submit>
        </>
      )}
    </ActionForm>
  );
}

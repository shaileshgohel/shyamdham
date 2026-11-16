"use client";
import { ActionForm, Submit } from "@/components/action-form";
import { useG } from "@/components/i18n-client";
import { saveHeadAction, saveMoneyAccountAction } from "../actions";

export function HeadForm({ type, h, canEdit }: { type: "INCOME" | "EXPENSE"; h?: { id: number; nameGu: string; nameEn: string | null; isActive: boolean; system: boolean }; canEdit: boolean }) {
  const g = useG();
  return (
    <ActionForm action={saveHeadAction} className="btns" resetOnSuccess={!h}>
      {(_s, pending) => (
        <>
          <input type="hidden" name="type" value={type} />
          {h && <input type="hidden" name="id" value={h.id} />}
          <input name="nameGu" type="text" defaultValue={h?.nameGu} placeholder={g("નામ (ગુજરાતી)", "Name (Gujarati)")} aria-label={g("નામ", "Name")} required disabled={!canEdit} style={{ flex: 2, minWidth: 160 }} />
          <input name="nameEn" type="text" defaultValue={h?.nameEn ?? ""} placeholder="English" aria-label="English" disabled={!canEdit} style={{ flex: 1, minWidth: 110 }} />
          {h && (
            <select name="isActive" defaultValue={h.isActive ? "1" : "0"} disabled={!canEdit || h.system} aria-label={g("સ્થિતિ", "Status")} style={{ width: "auto" }}>
              <option value="1">{g("ચાલુ", "Active")}</option><option value="0">{g("બંધ", "Off")}</option>
            </select>
          )}
          {h?.system && <span className="chip" title={g("દાન/બુકિંગ માટે આપોઆપ વપરાય છે", "Used automatically by donations/bookings")}>{g("સિસ્ટમ", "System")}</span>}
          {canEdit && <Submit pending={pending} className="btn sm">{h ? g("સેવ", "Save") : g("+ ઉમેરો", "+ Add")}</Submit>}
        </>
      )}
    </ActionForm>
  );
}

export function AccountForm({ a, canEdit }: { a?: { id: number; kind: string; name: string; bankDetails: string | null; openingBalance: number; openingDate: string; isActive: boolean }; canEdit: boolean }) {
  const g = useG();
  return (
    <ActionForm action={saveMoneyAccountAction} className="card form" resetOnSuccess={!a}>
      {(_s, pending) => (
        <>
          {a && <input type="hidden" name="id" value={a.id} />}
          <fieldset disabled={!canEdit} style={{ border: 0, padding: 0, margin: 0 }}>
            <div className="fields">
              <div className="field"><label>{g("નામ", "Name")}</label><input name="name" type="text" defaultValue={a?.name} required /></div>
              <div className="field"><label>{g("પ્રકાર", "Kind")}</label><select name="kind" defaultValue={a?.kind ?? "BANK"}><option value="CASH">{g("રોકડ", "Cash")}</option><option value="BANK">{g("બેંક", "Bank")}</option></select></div>
              <div className="field"><label>{g("બેંક / ખાતાની વિગત", "Bank / account details")}</label><input name="bankDetails" type="text" defaultValue={a?.bankDetails ?? ""} /></div>
              <div className="field"><label>{g("ઉઘડતી સિલક ₹", "Opening balance ₹")}</label><input name="openingBalance" type="text" inputMode="decimal" defaultValue={a ? String(a.openingBalance) : "0"} /></div>
              <div className="field"><label>{g("સિલકની તારીખ", "Balance as of")}</label><input name="openingDate" type="date" defaultValue={a?.openingDate} required /></div>
              {a && <div className="field"><label>{g("સ્થિતિ", "Status")}</label><select name="isActive" defaultValue={a.isActive ? "1" : "0"}><option value="1">{g("ચાલુ", "Active")}</option><option value="0">{g("બંધ", "Closed")}</option></select></div>}
            </div>
          </fieldset>
          {canEdit && <div className="btns"><Submit pending={pending} className="btn">{a ? g("સેવ", "Save") : g("+ ખાતું ઉમેરો", "+ Add account")}</Submit></div>}
        </>
      )}
    </ActionForm>
  );
}

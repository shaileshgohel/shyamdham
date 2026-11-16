"use client";
import { useState } from "react";
import { ActionForm, Submit } from "@/components/action-form";
import { MoneyFields, type AccountOpt } from "@/components/money-fields";
import { useG } from "@/components/i18n-client";
import { addChargeAction, bookingPaymentAction, bookingStatusAction, removeChargeAction, settleDepositAction } from "../actions";

const money = (n: number) => `₹ ${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export function PaymentPanel({ bookingId, accounts, balance, depositDue, today }: { bookingId: number; accounts: AccountOpt[]; balance: number; depositDue: number; today: string }) {
  const g = useG();
  const [kind, setKind] = useState(balance > 0 ? "RENT" : "DEPOSIT");
  return (
    <ActionForm action={bookingPaymentAction} className="card form" resetOnSuccess>
      {(_s, pending) => (
        <>
          <h2>{g("પેમેન્ટ લો", "Take a payment")}</h2>
          <input type="hidden" name="bookingId" value={bookingId} />
          <div className="fields">
            <div className="field"><label htmlFor="kind">{g("શેના માટે", "For")}</label>
              <select id="kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="RENT">{g(`બિલ પેટે (બાકી ${money(balance)})`, `Bill (due ${money(balance)})`)}</option>
                <option value="DEPOSIT">{g(`ડિપોઝિટ (બાકી ${money(depositDue)})`, `Deposit (due ${money(depositDue)})`)}</option>
              </select>
            </div>
            {kind === "RENT" && <div className="field"><label htmlFor="headKey">{g("હેડ", "Head")}</label><select id="headKey" name="headKey"><option value="booking_rent">{g("વાડી ભાડા આવક", "Wadi rent")}</option><option value="booking_damage">{g("નુકસાની વસૂલાત", "Damage recovery")}</option></select></div>}
            <div className="field"><label htmlFor="pay-amount">{g("રકમ ₹", "Amount ₹")}</label><input id="pay-amount" name="amount" type="text" inputMode="decimal" key={kind} defaultValue={String(kind === "RENT" ? Math.max(0, balance) : Math.max(0, depositDue))} /></div>
            <div className="field"><label htmlFor="pay-date">{g("તારીખ", "Date")}</label><input id="pay-date" name="date" type="date" defaultValue={today} max={today} /></div>
            <MoneyFields accounts={accounts} />
          </div>
          <div className="btns"><Submit pending={pending}>{g("પેમેન્ટ નોંધો", "Record payment")}</Submit></div>
        </>
      )}
    </ActionForm>
  );
}

export function DepositPanel({ bookingId, accounts, held, balance, today }: { bookingId: number; accounts: AccountOpt[]; held: number; balance: number; today: string }) {
  const g = useG();
  const adjust = Math.min(held, Math.max(0, balance));
  return (
    <ActionForm action={settleDepositAction} className="card form">
      {(_s, pending) => (
        <>
          <h2>{g("ડિપોઝિટ પરત / સરભર", "Return or adjust deposit")}</h2>
          <p className="small muted">{g(`સંસ્થા પાસે ${money(held)} ડિપોઝિટ છે. બિલમાં બાકી કે નુકસાન હોય તો તે ડિપોઝિટમાંથી સરભર કરો અને બાકીની પરત આપો.`, `${money(held)} deposit is held. Adjust any bill balance or damage from it and return the rest.`)}</p>
          <input type="hidden" name="bookingId" value={bookingId} />
          <div className="fields">
            <div className="field"><label htmlFor="adjust">{g("બિલમાં સરભર ₹", "Adjust against bill ₹")}</label><input id="adjust" name="adjust" type="text" inputMode="decimal" defaultValue={adjust ? String(adjust) : ""} /></div>
            <div className="field"><label htmlFor="headKey2">{g("સરભરનો હેડ", "Adjustment head")}</label><select id="headKey2" name="headKey"><option value="booking_rent">{g("વાડી ભાડા આવક", "Wadi rent")}</option><option value="booking_damage">{g("નુકસાની વસૂલાત", "Damage recovery")}</option></select></div>
            <div className="field"><label htmlFor="refund">{g("પરત આપવાની રકમ ₹", "Amount to return ₹")}</label><input id="refund" name="amount" type="text" inputMode="decimal" defaultValue={String(held - adjust)} /></div>
            <div className="field"><label htmlFor="dep-date">{g("તારીખ", "Date")}</label><input id="dep-date" name="date" type="date" defaultValue={today} max={today} /></div>
            <MoneyFields accounts={accounts} />
          </div>
          <div className="btns"><Submit pending={pending}>{g("ડિપોઝિટ હિસાબ નોંધો", "Record deposit settlement")}</Submit></div>
        </>
      )}
    </ActionForm>
  );
}

export function ChargePanel({ bookingId }: { bookingId: number }) {
  const g = useG();
  return (
    <ActionForm action={addChargeAction} className="card form" resetOnSuccess>
      {(_s, pending) => (
        <>
          <h2>{g("બિલમાં ચાર્જ ઉમેરો", "Add a charge to the bill")}</h2>
          <input type="hidden" name="bookingId" value={bookingId} />
          <div className="fields">
            <div className="field"><label htmlFor="ckind">{g("પ્રકાર", "Kind")}</label><select id="ckind" name="kind"><option value="DAMAGE">{g("નુકસાન / ખૂટ", "Damage / missing")}</option><option value="MANUAL">{g("વધારાનો ચાર્જ", "Extra charge")}</option></select></div>
            <div className="field"><label htmlFor="description">{g("વિગત", "Details")}</label><input id="description" name="description" type="text" required /></div>
            <div className="field"><label htmlFor="qty">{g("જથ્થો", "Qty")}</label><input id="qty" name="qty" type="text" inputMode="decimal" defaultValue="1" /></div>
            <div className="field"><label htmlFor="rate">{g("દર ₹", "Rate ₹")}</label><input id="rate" name="rate" type="text" inputMode="decimal" required /></div>
          </div>
          <div className="btns"><Submit pending={pending} className="btn">{g("ઉમેરો", "Add")}</Submit></div>
        </>
      )}
    </ActionForm>
  );
}

export function RemoveLine({ lineId, label }: { lineId: number; label: string }) {
  return (
    <ActionForm action={removeChargeAction} className="">
      {(_s, pending) => (<><input type="hidden" name="lineId" value={lineId} /><Submit pending={pending} className="linkbtn small">{label}</Submit></>)}
    </ActionForm>
  );
}

export function StatusPanel({ bookingId, status, canCancel }: { bookingId: number; status: string; canCancel: boolean }) {
  const g = useG();
  const [cancel, setCancel] = useState(false);
  return (
    <div className="btns">
      {status === "CONFIRMED" && (
        <ActionForm action={bookingStatusAction} className="">
          {(_s, pending) => (<><input type="hidden" name="bookingId" value={bookingId} /><input type="hidden" name="status" value="COMPLETED" /><Submit pending={pending} className="btn">{g("✓ પ્રસંગ પૂરો, હિસાબ બંધ", "✓ Event done, close")}</Submit></>)}
        </ActionForm>
      )}
      {status === "COMPLETED" && (
        <ActionForm action={bookingStatusAction} className="">
          {(_s, pending) => (<><input type="hidden" name="bookingId" value={bookingId} /><input type="hidden" name="status" value="CONFIRMED" /><Submit pending={pending} className="btn">{g("ફરી ખોલો", "Reopen")}</Submit></>)}
        </ActionForm>
      )}
      {status !== "CANCELLED" && canCancel && (cancel ? (
        <ActionForm action={bookingStatusAction} className="card form">
          {(_s, pending) => (
            <>
              <input type="hidden" name="bookingId" value={bookingId} /><input type="hidden" name="status" value="CANCELLED" />
              <p className="small">{g("મળેલી ભાડાની રકમ આવકમાં રહેશે (રદ ચાર્જ). પરત આપવી હોય તો હિસાબમાં જાવક વાઉચર બનાવો. ડિપોઝિટ પહેલાં પરત કરવી પડશે.", "Rent already received stays as income (cancellation charge). To refund it, enter an expense voucher. Any deposit must be returned first.")}</p>
              <div className="field"><label htmlFor="creason">{g("કારણ", "Reason")}</label><input id="creason" name="reason" type="text" required /></div>
              <div className="btns"><Submit pending={pending} className="btn danger">{g("બુકિંગ રદ કરો", "Cancel booking")}</Submit></div>
            </>
          )}
        </ActionForm>
      ) : <button className="btn danger" type="button" onClick={() => setCancel(true)}>{g("બુકિંગ રદ કરો", "Cancel booking")}</button>)}
    </div>
  );
}

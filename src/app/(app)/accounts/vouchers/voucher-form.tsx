"use client";
import { ActionForm, Submit } from "@/components/action-form";
import { MoneyFields, type AccountOpt } from "@/components/money-fields";
import { useG } from "@/components/i18n-client";
import { createVoucherAction } from "../actions";

export function VoucherForm({ type, heads, accounts, today, mayBackdate }: { type: "INCOME" | "EXPENSE" | "CONTRA"; heads: { id: number; name: string }[]; accounts: AccountOpt[]; today: string; mayBackdate: boolean }) {
  const g = useG();
  return (
    <ActionForm action={createVoucherAction}>
      {(_s, pending) => (
        <>
          <input type="hidden" name="type" value={type} />
          <section className="card">
            <div className="fields">
              <div className="field"><label htmlFor="amount">{g("રકમ ₹", "Amount ₹")} <span className="req">*</span></label><input id="amount" name="amount" type="text" inputMode="decimal" required /></div>
              <div className="field"><label htmlFor="date">{g("તારીખ", "Date")}</label><input id="date" name="date" type="date" defaultValue={today} max={today} readOnly={!mayBackdate} /></div>
              {type === "CONTRA" ? (
                <>
                  <div className="field"><label htmlFor="accountId">{g("કયા ખાતામાંથી", "From account")}</label><select id="accountId" name="accountId">{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
                  <div className="field"><label htmlFor="toAccountId">{g("કયા ખાતામાં", "To account")}</label><select id="toAccountId" name="toAccountId" defaultValue={accounts[1]?.id}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
                  <div className="field"><label htmlFor="reference">{g("સ્લિપ / ચેક નં.", "Slip / cheque no.")}</label><input id="reference" name="reference" type="text" /></div>
                </>
              ) : (
                <>
                  <div className="field"><label htmlFor="headId">{g("હેડ", "Head")}</label><select id="headId" name="headId">{heads.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select></div>
                  <MoneyFields accounts={accounts} />
                  <div className="field"><label htmlFor="party">{type === "EXPENSE" ? g("કોને ચૂકવ્યા", "Paid to") : g("કોની પાસેથી", "Received from")}{type === "EXPENSE" && <span className="req"> *</span>}</label><input id="party" name="party" type="text" /></div>
                </>
              )}
              <div className="field wide"><label htmlFor="narration">{g("વિગત", "Details")}</label><input id="narration" name="narration" type="text" placeholder={type === "CONTRA" ? g("દા.ત. રોકડ બેંકમાં જમા", "e.g. cash deposited in bank") : g("દા.ત. ઓક્ટોબરનું લાઈટ બિલ", "e.g. October electricity bill")} /></div>
              {type !== "CONTRA" && (
                <div className="field wide"><label htmlFor="attachment">{g("બિલ / વાઉચરનો ફોટો (વૈકલ્પિક, JPG/PNG/PDF, 3 MB સુધી)", "Photo of the bill (optional, JPG/PNG/PDF, up to 3 MB)")}</label><input id="attachment" name="attachment" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" capture="environment" /></div>
              )}
            </div>
          </section>
          <p className="small muted">{g("સેવ કર્યા પછી વાઉચર સુધારી શકાતું નથી; ભૂલ હોય તો રદ કરીને નવું બનાવો.", "A saved voucher cannot be edited; if it is wrong, cancel it and enter a new one.")}</p>
          <div className="btns"><Submit pending={pending}>{g("સેવ કરો", "Save")}</Submit></div>
        </>
      )}
    </ActionForm>
  );
}

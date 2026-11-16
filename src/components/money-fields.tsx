"use client";
import { useState } from "react";
import { useG } from "./i18n-client";

export type AccountOpt = { id: number; name: string; kind: string };

const MODES: [string, string, string][] = [["CASH", "રોકડ", "Cash"], ["UPI", "UPI", "UPI"], ["CHEQUE", "ચેક", "Cheque"], ["BANK", "બેંક ટ્રાન્સફર", "Bank transfer"]];

/** Payment mode, the matching cash or bank account, and cheque/UTR number. */
export function MoneyFields({ accounts, prefix = "", defaultMode = "CASH" }: { accounts: AccountOpt[]; prefix?: string; defaultMode?: string }) {
  const g = useG();
  const [mode, setMode] = useState(defaultMode);
  const kind = mode === "CASH" ? "CASH" : "BANK";
  const fit = accounts.filter((a) => a.kind === kind);
  return (
    <>
      <div className="field">
        <label htmlFor={`${prefix}mode`}>{g("પેમેન્ટ", "Payment")}</label>
        <select id={`${prefix}mode`} name={`${prefix}mode`} value={mode} onChange={(e) => setMode(e.target.value)}>
          {MODES.map(([k, gu, en]) => <option key={k} value={k}>{g(gu, en)}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor={`${prefix}accountId`}>{kind === "CASH" ? g("રોકડ ખાતું", "Cash account") : g("બેંક ખાતું", "Bank account")}</label>
        <select id={`${prefix}accountId`} name={`${prefix}accountId`} key={kind}>
          {fit.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        {!fit.length && <span className="err">{g("આ પ્રકારનું ખાતું નથી. હિસાબ → સેટઅપમાં ઉમેરો.", "No account of this kind. Add one under Accounts → Setup.")}</span>}
      </div>
      {mode !== "CASH" && (
        <div className="field">
          <label htmlFor={`${prefix}reference`}>{mode === "CHEQUE" ? g("ચેક નં. / બેંક", "Cheque no. / bank") : g("UTR / ટ્રાન્ઝેક્શન નં.", "UTR / transaction no.")}</label>
          <input id={`${prefix}reference`} name={`${prefix}reference`} type="text" maxLength={60} />
        </div>
      )}
    </>
  );
}

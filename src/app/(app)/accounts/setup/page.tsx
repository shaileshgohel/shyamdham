import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { can } from "@/lib/permissions";
import { fyRange } from "@/lib/money";
import { todayIST } from "@/lib/format";
import { AccountsTabs } from "../nav";
import { AccountForm, HeadForm } from "./forms";

export const metadata = { title: "હિસાબ સેટઅપ" };

export default async function SetupPage() {
  const user = await requirePage("accounts", "view");
  const t = await getT();
  const canEdit = can(user.role, "accounts", "edit");
  const [heads, accounts] = await Promise.all([
    db.accountHead.findMany({ orderBy: [{ sortOrder: "asc" }, { nameGu: "asc" }] }),
    db.moneyAccount.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
  ]);
  const block = (type: "INCOME" | "EXPENSE", title: string) => (
    <section className="card">
      <h2>{title}</h2>
      {heads.filter((h) => h.type === type).map((h) => <HeadForm key={h.id} type={type} canEdit={canEdit} h={{ id: h.id, nameGu: h.nameGu, nameEn: h.nameEn, isActive: h.isActive, system: !!h.systemKey }} />)}
      {canEdit && <><hr style={{ border: 0, borderTop: "1px solid var(--line)", width: "100%" }} /><HeadForm type={type} canEdit /></>}
    </section>
  );
  return (
    <>
      <div className="pagehead"><div><h1>{t.g("હિસાબ સેટઅપ", "Accounts setup")}</h1><p className="muted small" style={{ maxWidth: 720 }}>{t.g("હેડ બંધ કરવાથી જૂની એન્ટ્રી બદલાતી નથી, ફક્ત નવી એન્ટ્રીમાં દેખાતો નથી. દરેક ફેરફાર ઓડિટ લોગમાં નોંધાય છે.", "Switching a head off does not change old entries; it only stops appearing for new ones. Every change is recorded in the audit log.")}</p></div></div>
      <AccountsTabs t={t} on="/accounts/setup" />
      <h2>{t.g("રોકડ અને બેંક ખાતાં", "Cash and bank accounts")}</h2>
      {accounts.map((a) => <AccountForm key={a.id} canEdit={canEdit} a={{ id: a.id, kind: a.kind, name: a.name, bankDetails: a.bankDetails, openingBalance: Number(a.openingBalance), openingDate: a.openingDate.toISOString().slice(0, 10), isActive: a.isActive }} />)}
      {canEdit && <details className="card"><summary style={{ cursor: "pointer" }}>{t.g("+ નવું ખાતું", "+ New account")}</summary><AccountForm canEdit a={undefined} /></details>}
      <p className="small muted">{t.g(`ઉઘડતી સિલક: પોર્ટલ શરૂ કરો તે દિવસની રોકડ અને બેંક સિલક લખો (દા.ત. ${fyRange(todayIST()).from}).`, `Opening balance: enter the cash and bank balance on the day you start using the portal (e.g. ${fyRange(todayIST()).from}).`)}</p>
      <div className="grid2">
        {block("INCOME", t.g("આવક હેડ", "Income heads"))}
        {block("EXPENSE", t.g("જાવક હેડ", "Expense heads"))}
      </div>
    </>
  );
}

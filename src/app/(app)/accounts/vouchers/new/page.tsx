import { requirePage } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { can } from "@/lib/permissions";
import { activeAccounts, activeHeads } from "@/lib/accounts";
import { todayIST } from "@/lib/format";
import { VoucherForm } from "../voucher-form";

export const metadata = { title: "નવું વાઉચર" };

export default async function NewVoucherPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const user = await requirePage("accounts", "create");
  const t = await getT();
  const raw = (await searchParams).type;
  const type = raw === "INCOME" || raw === "CONTRA" ? raw : "EXPENSE";
  const [heads, accounts] = await Promise.all([type === "CONTRA" ? Promise.resolve([]) : activeHeads(type), activeAccounts()]);
  // Donations and wadi rent have their own screens, so their heads are not offered here.
  const usable = heads.filter((h) => !["donation_general", "booking_rent", "booking_damage"].includes(h.systemKey ?? ""));
  const title = type === "INCOME" ? t.g("આવક વાઉચર", "Income voucher") : type === "CONTRA" ? t.g("ખાતાફેર (રોકડ ↔ બેંક)", "Transfer (cash ↔ bank)") : t.g("જાવક વાઉચર", "Expense voucher");
  return (
    <>
      <div className="pagehead"><div><h1>{title}</h1>{type === "INCOME" && <p className="muted small">{t.g("દાન માટે દાન રસીદ વાપરો, જેથી દાતાને રસીદ મળે.", "For donations use the donation receipt, so the donor gets a receipt.")}</p>}</div></div>
      <VoucherForm type={type} heads={usable.map((h) => ({ id: h.id, name: t.lang === "en" ? h.nameEn ?? h.nameGu : h.nameGu }))} accounts={accounts.map((a) => ({ id: a.id, name: a.name, kind: a.kind }))} today={todayIST()} mayBackdate={can(user.role, "accounts", "edit")} />
    </>
  );
}

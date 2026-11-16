import { requirePage } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { can } from "@/lib/permissions";
import { activeAccounts, activeHeads } from "@/lib/accounts";
import { todayIST } from "@/lib/format";
import { DonationForm } from "../donation-form";

export const metadata = { title: "નવી રસીદ" };

export default async function NewDonationPage() {
  const user = await requirePage("donations", "create");
  const t = await getT();
  const [heads, accounts] = await Promise.all([activeHeads("INCOME"), activeAccounts()]);
  const donationHeads = heads.filter((h) => !["booking_rent", "booking_damage"].includes(h.systemKey ?? ""));
  return (
    <>
      <div className="pagehead"><div><h1>{t.g("નવી દાન રસીદ", "New donation receipt")}</h1><p className="muted small">{t.g("રસીદ નંબર સેવ કરતી વખતે આપોઆપ મળશે.", "The receipt number is assigned on save.")}</p></div></div>
      <DonationForm
        heads={donationHeads.map((h) => ({ id: h.id, name: t.lang === "en" ? h.nameEn ?? h.nameGu : h.nameGu }))}
        defaultHeadId={donationHeads.find((h) => h.systemKey === "donation_general")?.id}
        accounts={accounts.map((a) => ({ id: a.id, name: a.name, kind: a.kind }))}
        today={todayIST()}
        mayBackdate={can(user.role, "donations", "edit")}
      />
    </>
  );
}

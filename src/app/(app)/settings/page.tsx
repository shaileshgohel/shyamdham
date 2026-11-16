import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { canReadAudit } from "@/lib/permissions";
import { getSettings, SETTING_FIELDS } from "@/lib/settings";
import { SettingsForm } from "./form";

export const metadata = { title: "સંસ્થાની વિગત" };

export default async function SettingsPage() {
  const user = await requireUser();
  if (!canReadAudit(user.role)) redirect("/dashboard?denied=1");
  const t = await getT();
  const s = await getSettings();
  return (
    <>
      <div className="pagehead"><div><h1>{t.g("સંસ્થાની વિગત", "Trust details")}</h1><p className="muted small">{t.g("આ વિગત દાન રસીદ અને વાડી બિલ પર છપાય છે.", "These details are printed on donation receipts and wadi bills.")}</p></div></div>
      <SettingsForm fields={SETTING_FIELDS.map((f) => ({ key: f.key, label: t.lang === "en" ? f.en : f.gu, value: s[f.key], long: ["g80_text", "receipt_footer", "bill_terms", "address"].includes(f.key) }))} />
    </>
  );
}

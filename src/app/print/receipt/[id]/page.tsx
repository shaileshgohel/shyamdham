import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getT } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";
import { siteUrl } from "@/lib/site";
import { ReceiptDoc } from "@/components/receipt-doc";
import { PrintBar } from "@/components/print-bar";

export const metadata = { title: "રસીદ" };

export default async function PrintReceipt({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ auto?: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) redirect("/login");
  if (!can(user.role, "donations", "view")) redirect("/dashboard?denied=1");
  const t = await getT();
  const id = Number((await params).id);
  const d = Number.isInteger(id) ? await db.donation.findUnique({ where: { id }, include: { head: true } }) : null;
  if (!d) notFound();
  const [settings, base] = await Promise.all([getSettings(), siteUrl()]);
  return (
    <>
      <PrintBar back={`/donations/${d.id}`} backLabel={t("back")} printLabel={t.g("છાપો / PDF સેવ કરો", "Print / Save as PDF")} auto={(await searchParams).auto === "1"} />
      <ReceiptDoc d={d} head={d.head} settings={settings} verifyUrl={`${base}/verify/${d.verifyCode}`} />
    </>
  );
}

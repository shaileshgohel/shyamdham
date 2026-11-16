import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getT } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";
import { loadBooking } from "@/lib/bookings";
import { BillDoc } from "@/components/bill-doc";
import { PrintBar } from "@/components/print-bar";

export const metadata = { title: "બિલ" };

export default async function PrintBill({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) redirect("/login");
  if (!can(user.role, "bookings", "view")) redirect("/dashboard?denied=1");
  const t = await getT();
  const b = await loadBooking(Number((await params).id) || 0);
  if (!b) notFound();
  return (
    <>
      <PrintBar back={`/bookings/${b.id}`} backLabel={t("back")} printLabel={t.g("છાપો / PDF સેવ કરો", "Print / Save as PDF")} />
      <BillDoc b={b} settings={await getSettings()} />
    </>
  );
}

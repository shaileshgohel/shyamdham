import { notFound, redirect } from "next/navigation";
import { requirePage } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { EVENT_TYPES, loadBooking } from "@/lib/bookings";
import { todayIST } from "@/lib/format";
import { ymdOf } from "@/lib/money";
import { BookingForm } from "../../booking-form";
import { bookingFormData } from "../../form-data";

export const metadata = { title: "બુકિંગ સુધારો" };

export default async function EditBookingPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePage("bookings", "edit");
  const t = await getT();
  const b = await loadBooking(Number((await params).id) || 0);
  if (!b) notFound();
  if (b.status === "CANCELLED") redirect(`/bookings/${b.id}`);
  const { facilities, charges } = await bookingFormData();
  const extras: Record<number, number> = {};
  for (const l of b.lines.filter((l) => l.kind === "EXTRA")) {
    const c = charges.find((c) => l.description.startsWith(c.name));
    if (c) extras[c.id] = Number(l.qty);
  }
  const disc = b.lines.find((l) => l.kind === "DISCOUNT");
  return (
    <>
      <div className="pagehead"><div><span className="muted">{b.bookingNo}</span><h1>{t.g("બુકિંગ સુધારો", "Edit booking")}</h1></div></div>
      <BookingForm today={todayIST()} facilities={facilities} charges={charges} events={EVENT_TYPES.includes(b.eventType) ? EVENT_TYPES : [b.eventType, ...EVENT_TYPES]}
        v={{ id: b.id, hirerName: b.hirerName, familyId: b.familyId, mobile: b.mobile ?? "", address: b.address ?? "", isMember: b.isMember, eventType: b.eventType, fromDate: ymdOf(b.fromDate), toDate: ymdOf(b.toDate), slot: b.slot, guests: b.guests ? String(b.guests) : "", notes: b.notes ?? "", facilityIds: b.facilities.map((f) => f.facilityId), extras, discount: disc ? String(-Number(disc.amount)) : "", discountNote: disc?.description.replace(/^ડિસ્કાઉન્ટ:?\s*/, "") ?? "", depositAmount: String(Number(b.depositAmount)), extraLines: b.lines.filter((l) => l.kind === "DAMAGE" || l.kind === "MANUAL").length }} />
    </>
  );
}

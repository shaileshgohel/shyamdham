import { requirePage } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { EVENT_TYPES } from "@/lib/bookings";
import { isYmd } from "@/lib/money";
import { todayIST } from "@/lib/format";
import { BookingForm } from "../booking-form";
import { bookingFormData } from "../form-data";

export const metadata = { title: "નવું બુકિંગ" };

export default async function NewBookingPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  await requirePage("bookings", "create");
  const t = await getT();
  const today = todayIST();
  const d = (await searchParams).date;
  const date = isYmd(d) && d >= today ? d : today;
  const { facilities, charges } = await bookingFormData();
  return (
    <>
      <div className="pagehead"><div><h1>{t.g("નવું વાડી બુકિંગ", "New wadi booking")}</h1><p className="muted small">{t.g("એક જ સુવિધા એક જ દિવસે બે વાર બુક થઈ શકતી નથી.", "The same facility cannot be booked twice for the same day.")}</p></div></div>
      <BookingForm today={today} facilities={facilities} charges={charges} events={EVENT_TYPES}
        v={{ hirerName: "", familyId: null, mobile: "", address: "", isMember: false, eventType: EVENT_TYPES[0], fromDate: date, toDate: date, slot: "FULL", guests: "", notes: "", facilityIds: facilities[0] ? [facilities[0].id] : [], extras: {}, discount: "", discountNote: "", depositAmount: "", extraLines: 0 }} />
    </>
  );
}

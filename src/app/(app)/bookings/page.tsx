import Link from "next/link";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { can } from "@/lib/permissions";
import { BOOKING_STATUS_EN, BOOKING_STATUS_GU, SLOT_EN, SLOT_GU, summarize } from "@/lib/bookings";
import { fmtDate, fmtMobile, todayIST } from "@/lib/format";
import { addDays, dateOnly, inr, MONTHS_EN, MONTHS_GU, ymdOf } from "@/lib/money";

export const metadata = { title: "વાડી બુકિંગ" };

export default async function BookingsPage({ searchParams }: { searchParams: Promise<{ m?: string; facility?: string }> }) {
  const user = await requirePage("bookings", "view");
  const t = await getT();
  const sp = await searchParams;
  const today = todayIST();
  const month = /^\d{4}-\d{2}$/.test(sp.m ?? "") ? sp.m! : today.slice(0, 7);
  const [y, mo] = month.split("-").map(Number);
  const first = `${month}-01`;
  const startDow = new Date(`${first}T00:00:00Z`).getUTCDay();
  const gridStart = addDays(first, -startDow);
  const gridEnd = addDays(gridStart, 41);
  const facilityId = Number(sp.facility) || undefined;
  const [facilities, bookings, upcoming] = await Promise.all([
    db.facility.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    db.booking.findMany({
      where: { status: { not: "CANCELLED" }, fromDate: { lte: dateOnly(gridEnd) }, toDate: { gte: dateOnly(gridStart) }, ...(facilityId ? { facilities: { some: { facilityId } } } : {}) },
      include: { facilities: { include: { facility: true } }, lines: true, vouchers: true },
      orderBy: { fromDate: "asc" },
    }),
    db.booking.findMany({
      where: { status: "CONFIRMED", toDate: { gte: dateOnly(today) } },
      include: { facilities: { include: { facility: true } }, lines: true, vouchers: true },
      orderBy: { fromDate: "asc" }, take: 15,
    }),
  ]);
  const prev = mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`;
  const next = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
  const months = t.lang === "en" ? MONTHS_EN : MONTHS_GU;
  const dows = t.lang === "en" ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] : ["રવિ", "સોમ", "મંગળ", "બુધ", "ગુરુ", "શુક્ર", "શનિ"];
  const slotL = (s: string) => (t.lang === "en" ? SLOT_EN : SLOT_GU)[s];
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const canCreate = can(user.role, "bookings", "create");
  return (
    <>
      <div className="pagehead">
        <div><h1>{t.g("વાડી બુકિંગ", "Wadi booking")}</h1></div>
        <div className="btns">
          <a className="btn" href="/export/bookings">Excel</a>
          {can(user.role, "bookings", "edit") && <Link className="btn" href="/bookings/setup">{t.g("સુવિધા અને દર", "Facilities & rates")}</Link>}
          {canCreate && <Link className="btn pri" href="/bookings/new">{t.g("+ નવું બુકિંગ", "+ New booking")}</Link>}
        </div>
      </div>
      <div className="pagehead">
        <div className="btns" style={{ flexDirection: "row", alignItems: "center" }}>
          <Link className="btn sm" href={`/bookings?m=${prev}${facilityId ? `&facility=${facilityId}` : ""}`}>‹</Link>
          <h2 style={{ minWidth: 150, textAlign: "center" }}>{months[mo - 1]} {y}</h2>
          <Link className="btn sm" href={`/bookings?m=${next}${facilityId ? `&facility=${facilityId}` : ""}`}>›</Link>
          {month !== today.slice(0, 7) && <Link className="btn sm" href="/bookings">{t.g("આજે", "Today")}</Link>}
        </div>
        <form className="btns" method="get">
          <input type="hidden" name="m" value={month} />
          <select name="facility" defaultValue={facilityId ?? ""} aria-label={t.g("સુવિધા", "Facility")} style={{ width: "auto" }}>
            <option value="">{t.g("બધી સુવિધા", "All facilities")}</option>
            {facilities.map((f) => <option key={f.id} value={f.id}>{f.nameGu}</option>)}
          </select>
          <button className="btn sm" type="submit">{t("filter")}</button>
        </form>
      </div>
      <div className="cal" role="grid">
        {dows.map((d) => <div key={d} className="dow">{d}</div>)}
        {cells.map((d) => {
          const inMonth = d.slice(0, 7) === month;
          const day = bookings.filter((b) => ymdOf(b.fromDate) <= d && ymdOf(b.toDate) >= d);
          return (
            <div key={d} className={`${inMonth ? "" : "other"}${d === today ? " today" : ""}`}>
              <div className="dnum"><span>{Number(d.slice(8))}</span>{canCreate && d >= today && <Link href={`/bookings/new?date=${d}`} aria-label={t.g("આ તારીખે બુકિંગ", "Book this date")}>+</Link>}</div>
              {day.map((b) => {
                const s = summarize(b);
                return <Link key={b.id} href={`/bookings/${b.id}`} className={`ev${b.status === "COMPLETED" ? " done" : s.balance > 0.001 ? " due" : ""}`} title={`${b.bookingNo} · ${b.hirerName} · ${b.eventType}`}>{b.facilities.map((f) => f.facility.nameGu).join("+")} · {b.slot !== "FULL" ? `${slotL(b.slot)} · ` : ""}{b.eventType}</Link>;
              })}
            </div>
          );
        })}
      </div>
      <p className="small muted">{t.g("વાદળી: પૈસા પૂરા મળ્યા · પીળું: બિલ બાકી · લીલું: પૂરું", "Blue: fully paid · Yellow: bill due · Green: completed")}</p>
      <section className="card">
        <h2>{t.g("આગામી બુકિંગ", "Upcoming bookings")}</h2>
        <div className="tablewrap">
          {upcoming.length ? (
            <table className="t">
              <thead><tr><th>{t.g("બુકિંગ નં.", "Booking no.")}</th><th>{t.g("તારીખ", "Date")}</th><th>{t.g("સુવિધા", "Facility")}</th><th>{t.g("પ્રસંગ", "Event")}</th><th>{t.g("નામ", "Name")}</th><th className="num">{t.g("બિલ", "Bill")}</th><th className="num">{t.g("બાકી", "Due")}</th><th>{t("status")}</th></tr></thead>
              <tbody>
                {upcoming.map((b) => {
                  const s = summarize(b);
                  return (
                    <tr key={b.id}>
                      <td className="nowrap"><Link href={`/bookings/${b.id}`}>{b.bookingNo}</Link></td>
                      <td className="nowrap">{fmtDate(b.fromDate)}{b.toDate.getTime() !== b.fromDate.getTime() ? ` – ${fmtDate(b.toDate)}` : ""} · {slotL(b.slot)}</td>
                      <td>{b.facilities.map((f) => f.facility.nameGu).join(", ")}</td>
                      <td>{b.eventType}</td>
                      <td>{b.hirerName}<br /><span className="small muted">{fmtMobile(b.mobile)}</span></td>
                      <td className="num">{inr(s.total)}</td>
                      <td className={`num ${s.balance > 0.001 ? "neg" : ""}`}>{inr(s.balance)}</td>
                      <td><span className="chip">{(t.lang === "en" ? BOOKING_STATUS_EN : BOOKING_STATUS_GU)[b.status]}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : <p className="muted" style={{ padding: 16 }}>{t.g("કોઈ આગામી બુકિંગ નથી.", "No upcoming bookings.")}</p>}
        </div>
      </section>
    </>
  );
}

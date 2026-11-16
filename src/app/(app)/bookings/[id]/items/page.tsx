import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getT } from "@/lib/i18n";
import { MOVEMENT_EN, MOVEMENT_GU, outstandingForBooking, stockByItem } from "@/lib/inventory";
import { fmtDate } from "@/lib/format";
import { IssueForm, ReturnForm } from "../../../inventory/forms";

export const metadata = { title: "વસ્તુ આપો / પરત" };

export default async function BookingItemsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePage("inventory", "view");
  const t = await getT();
  const b = await db.booking.findUnique({ where: { id: Number((await params).id) || 0 }, include: { movements: { include: { item: true }, orderBy: { id: "asc" } } } });
  if (!b) notFound();
  const items = await db.item.findMany({ where: { isActive: true }, orderBy: [{ category: "asc" }, { nameGu: "asc" }] });
  const stock = await stockByItem(items.map((i) => i.id));
  const out = outstandingForBooking(b.movements);
  const outItems = (await db.item.findMany({ where: { id: { in: [...out.entries()].filter(([, q]) => q > 0).map(([id]) => id) } } })).map((i) => ({ id: i.id, name: i.nameGu, unit: i.unit, out: out.get(i.id) ?? 0, rate: Number(i.chargeRate) }));
  const canEdit = can(user.role, "inventory", "edit") && b.status !== "CANCELLED";
  return (
    <>
      <div className="pagehead">
        <div><span className="muted">{b.bookingNo} · {fmtDate(b.fromDate)}</span><h1>{b.hirerName}: {t.g("વસ્તુ આપો / પરત", "Issue / return items")}</h1></div>
        <Link className="btn" href={`/bookings/${b.id}`}>{t.g("બુકિંગ પર પાછા", "Back to booking")}</Link>
      </div>
      {canEdit && outItems.length > 0 && <ReturnForm bookingId={b.id} items={outItems} />}
      {canEdit && <IssueForm bookingId={b.id} items={items.map((i) => ({ id: i.id, name: i.nameGu, unit: i.unit, available: stock(i.id).available }))} />}
      {b.movements.length > 0 && (
        <section className="card">
          <h2>{t.g("આ બુકિંગની નોંધ", "Record for this booking")}</h2>
          <div className="tablewrap"><table className="t">
            <thead><tr><th>{t.g("તારીખ", "Date")}</th><th>{t.g("વસ્તુ", "Item")}</th><th>{t.g("શું થયું", "What")}</th><th className="num">{t.g("જથ્થો", "Qty")}</th><th>{t.g("કોણે", "By")}</th></tr></thead>
            <tbody>{b.movements.map((m) => <tr key={m.id}><td>{fmtDate(m.date)}</td><td>{m.item.nameGu}</td><td>{(t.lang === "en" ? MOVEMENT_EN : MOVEMENT_GU)[m.type]}</td><td className="num">{m.qty}</td><td>{m.createdByName}</td></tr>)}</tbody>
          </table></div>
        </section>
      )}
    </>
  );
}

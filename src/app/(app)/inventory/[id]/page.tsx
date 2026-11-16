import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { can } from "@/lib/permissions";
import { applyMovements, ITEM_CATEGORIES, MOVEMENT_EN, MOVEMENT_GU } from "@/lib/inventory";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { ItemForm, MovementForm } from "../forms";

export const metadata = { title: "વસ્તુ" };

export default async function ItemPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string; saved?: string }> }) {
  const user = await requirePage("inventory", "view");
  const t = await getT();
  const item = await db.item.findUnique({ where: { id: Number((await params).id) || 0 }, include: { movements: { orderBy: { id: "desc" }, include: { booking: true } } } });
  if (!item) notFound();
  const sp = await searchParams;
  const s = applyMovements(item.movements);
  const canEdit = can(user.role, "inventory", "edit");
  return (
    <>
      {(sp.new || sp.saved) && <p className="alert ok" role="status">{t("saved")}</p>}
      <div className="pagehead"><div><span className="muted">{item.category}{item.location ? ` · ${item.location}` : ""}</span><h1>{item.nameGu}</h1></div><Link className="btn" href="/inventory">{t("back")}</Link></div>
      <div className="kpis">
        <div className="kpi"><span>{t.g("કુલ", "Owned")}</span><b>{s.owned}</b></div>
        <div className="kpi"><span>{t.g("બુકિંગમાં બહાર", "Out with bookings")}</span><b>{s.out}</b></div>
        <div className="kpi"><span>{t.g("નુકસાનવાળી", "Damaged")}</span><b>{s.damaged}</b></div>
        <div className="kpi"><span>{t.g("ઉપલબ્ધ", "Available")}</span><b className={s.available < item.minQty ? "neg" : undefined}>{s.available} {item.unit}</b></div>
      </div>
      {canEdit && <MovementForm itemId={item.id} unit={item.unit} available={s.available} damaged={s.damaged} />}
      <section className="card">
        <h2>{t.g("સ્ટોકનો ઇતિહાસ", "Stock history")}</h2>
        <div className="tablewrap">
          <table className="t">
            <thead><tr><th>{t.g("તારીખ", "Date")}</th><th>{t.g("શું થયું", "What")}</th><th className="num">{t.g("જથ્થો", "Qty")}</th><th>{t.g("બુકિંગ", "Booking")}</th><th>{t.g("નોંધ", "Note")}</th><th>{t.g("કોણે", "By")}</th></tr></thead>
            <tbody>{item.movements.map((m) => <tr key={m.id}><td className="nowrap">{fmtDate(m.date)}</td><td>{(t.lang === "en" ? MOVEMENT_EN : MOVEMENT_GU)[m.type]}</td><td className="num">{m.qty}</td><td>{m.booking ? <Link href={`/bookings/${m.booking.id}`}>{m.booking.bookingNo}</Link> : ""}</td><td>{m.notes}</td><td className="small">{m.createdByName}<br /><span className="muted">{fmtDateTime(m.createdAt)}</span></td></tr>)}</tbody>
          </table>
        </div>
      </section>
      {canEdit && (
        <details className="card">
          <summary style={{ cursor: "pointer" }}>{t.g("વસ્તુની વિગત સુધારો", "Edit item details")}</summary>
          <ItemForm categories={ITEM_CATEGORIES} v={{ id: item.id, nameGu: item.nameGu, category: item.category, location: item.location ?? "", unit: item.unit, minQty: item.minQty, chargeRate: Number(item.chargeRate), notes: item.notes ?? "", isActive: item.isActive }} />
        </details>
      )}
    </>
  );
}

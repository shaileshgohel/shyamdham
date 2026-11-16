import Link from "next/link";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { can } from "@/lib/permissions";
import { ITEM_CATEGORIES, stockByItem } from "@/lib/inventory";
import { fmtDate } from "@/lib/format";

export const metadata = { title: "ઇન્વેન્ટરી" };

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ cat?: string; q?: string; low?: string; inactive?: string }> }) {
  const user = await requirePage("inventory", "view");
  const t = await getT();
  const sp = await searchParams;
  const items = await db.item.findMany({
    where: { ...(sp.inactive ? {} : { isActive: true }), ...(sp.cat ? { category: sp.cat } : {}), ...(sp.q ? { nameGu: { contains: sp.q.slice(0, 40), mode: "insensitive" as const } } : {}) },
    orderBy: [{ category: "asc" }, { nameGu: "asc" }],
  });
  const stock = await stockByItem(items.map((i) => i.id));
  const rows = items.map((i) => ({ i, s: stock(i.id) })).filter((r) => !sp.low || r.s.available < r.i.minQty);
  const low = items.filter((i) => stock(i.id).available < i.minQty).length;
  const out = await db.stockMovement.findMany({ where: { bookingId: { not: null }, booking: { status: { not: "CANCELLED" } } }, include: { booking: true } });
  const byBooking = new Map<number, { no: string; name: string; date: Date; q: number }>();
  for (const m of out) {
    const sign = m.type === "ISSUE" ? 1 : ["RETURN", "RETURN_DAMAGED", "RETURN_MISSING"].includes(m.type) ? -1 : 0;
    const b = byBooking.get(m.bookingId!) ?? { no: m.booking!.bookingNo, name: m.booking!.hirerName, date: m.booking!.toDate, q: 0 };
    b.q += sign * m.qty;
    byBooking.set(m.bookingId!, b);
  }
  const pending = [...byBooking.entries()].filter(([, b]) => b.q > 0);
  const cats = Array.from(new Set([...ITEM_CATEGORIES, ...items.map((i) => i.category)]));
  return (
    <>
      <div className="pagehead">
        <div><h1>{t.g("ઇન્વેન્ટરી", "Inventory")}</h1></div>
        <div className="btns">
          <a className="btn" href="/export/inventory">Excel</a>
          {can(user.role, "inventory", "create") && <Link className="btn pri" href="/inventory/new">{t.g("+ નવી વસ્તુ", "+ New item")}</Link>}
        </div>
      </div>
      <div className="kpis">
        <div className="kpi"><span>{t.g("વસ્તુઓ", "Items")}</span><b>{items.length}</b></div>
        <Link className="kpi" href="/inventory?low=1" style={{ color: "inherit", textDecoration: "none" }}><span>{t.g("ઓછો સ્ટોક", "Low stock")}</span><b className={low ? "neg" : undefined}>{low}</b></Link>
        <div className="kpi"><span>{t.g("વસ્તુ બહાર હોય તેવા બુકિંગ", "Bookings with items out")}</span><b>{pending.length}</b></div>
      </div>
      {pending.length > 0 && (
        <section className="card">
          <h2>{t.g("પરત આવવાની બાકી", "Still to come back")}</h2>
          <div className="btns">{pending.map(([id, b]) => <Link key={id} className="chip gold" href={`/bookings/${id}/items`}>{b.no} · {b.name} · {b.q} {t.g("નંગ", "pcs")} · {fmtDate(b.date)}</Link>)}</div>
        </section>
      )}
      <form className="card" method="get">
        <div className="fields">
          <div className="field"><label htmlFor="q">{t("search")}</label><input id="q" name="q" type="search" defaultValue={sp.q} /></div>
          <div className="field"><label htmlFor="cat">{t.g("કેટેગરી", "Category")}</label><select id="cat" name="cat" defaultValue={sp.cat ?? ""}><option value="">{t("all")}</option>{cats.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div className="field"><label>&nbsp;</label><label className="check"><input type="checkbox" name="low" value="1" defaultChecked={!!sp.low} /> {t.g("ફક્ત ઓછો સ્ટોક", "Low stock only")}</label></div>
          <div className="field"><label>&nbsp;</label><label className="check"><input type="checkbox" name="inactive" value="1" defaultChecked={!!sp.inactive} /> {t.g("બંધ વસ્તુ પણ", "Include inactive")}</label></div>
        </div>
        <div className="btns"><button className="btn pri" type="submit">{t("filter")}</button></div>
      </form>
      <div className="tablewrap">
        {rows.length ? (
          <table className="t">
            <thead><tr><th>{t.g("વસ્તુ", "Item")}</th><th>{t.g("કેટેગરી", "Category")}</th><th>{t.g("સ્થળ", "Place")}</th><th className="num">{t.g("કુલ", "Owned")}</th><th className="num">{t.g("બહાર", "Out")}</th><th className="num">{t.g("નુકસાન", "Damaged")}</th><th className="num">{t.g("ઉપલબ્ધ", "Available")}</th><th>{t("status")}</th></tr></thead>
            <tbody>
              {rows.map(({ i, s }) => (
                <tr key={i.id} className={i.isActive ? undefined : "dim"}>
                  <td><Link href={`/inventory/${i.id}`}>{i.nameGu}</Link></td><td>{i.category}</td><td>{i.location}</td>
                  <td className="num">{s.owned} {i.unit}</td><td className="num">{s.out || ""}</td><td className="num">{s.damaged || ""}</td><td className="num"><b>{s.available}</b></td>
                  <td>{s.available < i.minQty ? <span className="chip bad">{t.g(`ઓછો (${i.minQty} જોઈએ)`, `Low (need ${i.minQty})`)}</span> : <span className="chip ok">{t.g("બરાબર", "OK")}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="muted" style={{ padding: 16 }}>{t("none_found")}</p>}
      </div>
    </>
  );
}

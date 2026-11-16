import "server-only";
import { db } from "./db";

export const ITEM_CATEGORIES = ["વાસણ", "ફર્નિચર", "બિછાત", "ઇલેક્ટ્રિક / સાઉન્ડ", "રસોડું", "સજાવટ", "અન્ય"];
export const MOVEMENT_GU: Record<string, string> = {
  PURCHASE: "ખરીદી / નવો સ્ટોક", ADJUST: "ગણતરી પ્રમાણે સુધારો", ISSUE: "બહાર આપ્યું", RETURN: "પરત (સારું)",
  RETURN_DAMAGED: "પરત (નુકસાન)", RETURN_MISSING: "ખૂટ્યું", DAMAGED: "સ્ટોરમાં નુકસાન", REPAIRED: "રિપેર થયું", WRITE_OFF: "કાઢી નાખ્યું",
};
export const MOVEMENT_EN: Record<string, string> = {
  PURCHASE: "Purchase / new stock", ADJUST: "Stock-count correction", ISSUE: "Issued", RETURN: "Returned (good)",
  RETURN_DAMAGED: "Returned (damaged)", RETURN_MISSING: "Missing", DAMAGED: "Damaged in store", REPAIRED: "Repaired", WRITE_OFF: "Written off",
};

// Effect of each movement on the three buckets.
const EFFECT: Record<string, { owned: number; out: number; damaged: number }> = {
  PURCHASE: { owned: 1, out: 0, damaged: 0 },
  ADJUST: { owned: 1, out: 0, damaged: 0 },
  ISSUE: { owned: 0, out: 1, damaged: 0 },
  RETURN: { owned: 0, out: -1, damaged: 0 },
  RETURN_DAMAGED: { owned: 0, out: -1, damaged: 1 },
  RETURN_MISSING: { owned: -1, out: -1, damaged: 0 },
  DAMAGED: { owned: 0, out: 0, damaged: 1 },
  REPAIRED: { owned: 0, out: 0, damaged: -1 },
  WRITE_OFF: { owned: -1, out: 0, damaged: -1 },
};

export type Stock = { owned: number; out: number; damaged: number; available: number };

export function applyMovements(ms: { type: string; qty: number }[]): Stock {
  const s = { owned: 0, out: 0, damaged: 0 };
  for (const m of ms) {
    const e = EFFECT[m.type];
    if (!e) continue;
    s.owned += e.owned * m.qty;
    s.out += e.out * m.qty;
    s.damaged += e.damaged * m.qty;
  }
  return { ...s, available: s.owned - s.out - s.damaged };
}

/** Current stock of every item (or the given items). */
export async function stockByItem(itemIds?: number[]) {
  const rows = await db.stockMovement.groupBy({
    by: ["itemId", "type"],
    where: itemIds ? { itemId: { in: itemIds } } : {},
    _sum: { qty: true },
  });
  const map = new Map<number, { type: string; qty: number }[]>();
  for (const r of rows) {
    if (!map.has(r.itemId)) map.set(r.itemId, []);
    map.get(r.itemId)!.push({ type: r.type, qty: r._sum.qty ?? 0 });
  }
  const out = new Map<number, Stock>();
  for (const [id, ms] of map) out.set(id, applyMovements(ms));
  return (id: number) => out.get(id) ?? { owned: 0, out: 0, damaged: 0, available: 0 };
}

/** Items still out with a booking: issued minus everything that came back or was reported missing. */
export function outstandingForBooking(ms: { itemId: number; type: string; qty: number }[]) {
  const m = new Map<number, number>();
  for (const x of ms) {
    const sign = x.type === "ISSUE" ? 1 : ["RETURN", "RETURN_DAMAGED", "RETURN_MISSING"].includes(x.type) ? -1 : 0;
    if (sign) m.set(x.itemId, (m.get(x.itemId) ?? 0) + sign * x.qty);
  }
  return m;
}

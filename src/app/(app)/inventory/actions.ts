"use server";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { db, type Tx } from "@/lib/db";
import { actorOf, PermissionError, requirePermission } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { applyMovements, ITEM_CATEGORIES, MOVEMENT_GU, outstandingForBooking } from "@/lib/inventory";
import { str } from "@/lib/forms";
import { getT } from "@/lib/i18n";
import { dateOnly, inr, parseAmountOrZero } from "@/lib/money";
import { todayIST } from "@/lib/format";
import type { ActionResult } from "@/components/action-form";

async function guard(action: "create" | "edit" | "cancel") {
  try {
    return await requirePermission("inventory", action);
  } catch (e) {
    if (e instanceof PermissionError) return null;
    throw e;
  }
}

const intOf = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  if (s === "") return 0;
  return /^-?\d{1,7}$/.test(s) ? Number(s) : NaN;
};

/** Current stock of one item, with its row locked so two people cannot issue the same pieces at once. */
async function lockedStock(tx: Tx, itemId: number) {
  await tx.$queryRaw`SELECT id FROM "Item" WHERE id = ${itemId} FOR UPDATE`;
  const ms = await tx.stockMovement.findMany({ where: { itemId }, select: { type: true, qty: true } });
  return applyMovements(ms);
}

export async function saveItemAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const t = await getT();
  const id = Number(fd.get("id")) || null;
  const user = await guard(id ? "edit" : "create");
  if (!user) return { error: t("forbidden") };
  const nameGu = str(fd, "nameGu", 80);
  const category = str(fd, "category", 40) ?? "અન્ય";
  const unit = str(fd, "unit", 20) ?? "નંગ";
  const minQty = intOf(fd.get("minQty"));
  const chargeRate = parseAmountOrZero(fd.get("chargeRate"));
  if (!nameGu || Number.isNaN(minQty) || minQty < 0 || chargeRate == null) return { error: t.g("નામ, ઓછામાં ઓછો જથ્થો અને ચાર્જ દર સાચા લખો.", "Enter a name, minimum quantity and charge rate correctly.") };
  const data = { nameGu, category: ITEM_CATEGORIES.includes(category) ? category : category, location: str(fd, "location", 60), unit, minQty, chargeRate: new Prisma.Decimal(chargeRate.toFixed(2)), notes: str(fd, "notes", 300), isActive: fd.get("isActive") !== "0" };
  const actor = actorOf(user);
  try {
    const itemId = await db.$transaction(async (tx) => {
      if (id) {
        const before = await tx.item.findUniqueOrThrow({ where: { id } });
        await tx.item.update({ where: { id }, data });
        await audit(actor, { action: "edit", entity: "item", entityId: id, docNo: nameGu, summary: `વસ્તુ સુધારી: ${nameGu}`, changes: { નામ: [before.nameGu, nameGu], "ઓછામાં ઓછું": [before.minQty, minQty], "ચાર્જ દર": [Number(before.chargeRate), chargeRate], ચાલુ: [before.isActive, data.isActive] } }, tx);
        return id;
      }
      const opening = intOf(fd.get("openingQty"));
      if (Number.isNaN(opening) || opening < 0) throw new Error("qty");
      const it = await tx.item.create({ data });
      if (opening > 0) await tx.stockMovement.create({ data: { itemId: it.id, date: dateOnly(todayIST()), type: "PURCHASE", qty: opening, notes: "શરૂઆતનો સ્ટોક", createdById: user.id, createdByName: user.fullName } });
      await audit(actor, { action: "create", entity: "item", entityId: it.id, docNo: nameGu, summary: `નવી વસ્તુ: ${nameGu} · શરૂઆતનો સ્ટોક ${opening} ${unit}` }, tx);
      return it.id;
    });
    revalidatePath("/inventory");
    return { ok: true, redirect: `/inventory/${itemId}${id ? "?saved=1" : "?new=1"}` };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { error: t.g("આ નામની વસ્તુ પહેલેથી છે.", "An item with this name already exists.") };
    if (e instanceof Error && e.message === "qty") return { error: t.g("શરૂઆતનો જથ્થો ખોટો છે.", "Opening quantity is not valid.") };
    throw e;
  }
}

export async function stockMovementAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const t = await getT();
  const user = await guard("edit");
  if (!user) return { error: t("forbidden") };
  const itemId = Number(fd.get("itemId"));
  const type = String(fd.get("type"));
  if (!["PURCHASE", "COUNT", "DAMAGED", "REPAIRED", "WRITE_OFF"].includes(type)) return { error: t("err_form") };
  const qtyIn = intOf(fd.get("qty"));
  if (Number.isNaN(qtyIn) || qtyIn < 0 || (type !== "COUNT" && qtyIn === 0)) return { error: t.g("જથ્થો સાચો લખો (ફક્ત આંકડા).", "Enter a valid quantity (digits only).") };
  const notes = str(fd, "notes", 300);
  if ((type === "COUNT" || type === "WRITE_OFF") && !notes) return { error: t.g("આ ફેરફારનું કારણ લખો.", "Give a reason for this change.") };
  const item = await db.item.findUnique({ where: { id: itemId } });
  if (!item) return { error: t("err_form") };
  const actor = actorOf(user);
  const res = await db.$transaction(async (tx) => {
    const st = await lockedStock(tx, itemId);
    let mType = type, qty = qtyIn;
    if (type === "COUNT") {
      // Counted pieces in the store (not counting what is out with bookings or set aside as damaged).
      const diff = qtyIn - st.available;
      if (diff === 0) return { same: true };
      mType = "ADJUST"; qty = diff;
    }
    if (type === "DAMAGED" && qty > st.available) return { err: t.g(`ફક્ત ${st.available} ઉપલબ્ધ છે.`, `Only ${st.available} available.`) };
    if ((type === "REPAIRED" || type === "WRITE_OFF") && qty > st.damaged) return { err: t.g(`નુકસાનવાળી ફક્ત ${st.damaged} છે.`, `Only ${st.damaged} are marked damaged.`) };
    await tx.stockMovement.create({ data: { itemId, date: dateOnly(todayIST()), type: mType, qty, notes, createdById: user.id, createdByName: user.fullName } });
    await audit(actor, { action: "edit", entity: "item", entityId: itemId, docNo: item.nameGu, summary: `${MOVEMENT_GU[mType]}: ${item.nameGu} ${qty > 0 && mType === "ADJUST" ? "+" : ""}${qty} ${item.unit}${notes ? ` · ${notes}` : ""}` }, tx);
    return {};
  });
  if ("err" in res) return { error: res.err };
  if ("same" in res) return { ok: true, message: t.g("ગણતરી સ્ટોક સાથે મળે છે, કોઈ ફેરફાર નથી.", "The count matches the stock; nothing changed.") };
  revalidatePath(`/inventory/${itemId}`);
  return { ok: true, message: t("saved") };
}

export async function issueItemsAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const t = await getT();
  const user = await guard("edit");
  if (!user) return { error: t("forbidden") };
  const bookingId = Number(fd.get("bookingId"));
  const booking = await db.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.status === "CANCELLED") return { error: t("err_form") };
  const items = await db.item.findMany({ where: { isActive: true } });
  const wanted = items.map((i) => ({ i, q: intOf(fd.get(`issue.${i.id}`)) })).filter((x) => x.q !== 0);
  if (wanted.some((x) => Number.isNaN(x.q) || x.q < 0)) return { error: t.g("જથ્થો સાચો લખો.", "Enter valid quantities.") };
  if (!wanted.length) return { error: t.g("આપવાની વસ્તુનો જથ્થો લખો.", "Enter how many of each item to issue.") };
  const actor = actorOf(user);
  const res = await db.$transaction(async (tx) => {
    for (const { i, q } of wanted) {
      const st = await lockedStock(tx, i.id);
      if (q > st.available) return { err: t.g(`${i.nameGu}: ફક્ત ${st.available} ઉપલબ્ધ છે.`, `${i.nameGu}: only ${st.available} available.`) };
      await tx.stockMovement.create({ data: { itemId: i.id, date: dateOnly(todayIST()), type: "ISSUE", qty: q, bookingId, createdById: user.id, createdByName: user.fullName } });
    }
    await audit(actor, { action: "edit", entity: "booking", entityId: bookingId, docNo: booking.bookingNo, summary: `વસ્તુ આપી: ${wanted.map((x) => `${x.i.nameGu} ${x.q}`).join(", ")}` }, tx);
    return {};
  });
  if ("err" in res) return { error: res.err };
  revalidatePath(`/bookings/${bookingId}/items`);
  return { ok: true, message: t.g("વસ્તુ આપ્યાની નોંધ થઈ.", "Issue recorded.") };
}

export async function returnItemsAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const t = await getT();
  const user = await guard("edit");
  if (!user) return { error: t("forbidden") };
  const bookingId = Number(fd.get("bookingId"));
  const booking = await db.booking.findUnique({ where: { id: bookingId }, include: { movements: true, lines: true } });
  if (!booking) return { error: t("err_form") };
  const out = outstandingForBooking(booking.movements);
  const items = await db.item.findMany({ where: { id: { in: [...out.keys()] } } });
  const rows = items.map((i) => ({ i, good: intOf(fd.get(`good.${i.id}`)), damaged: intOf(fd.get(`damaged.${i.id}`)), missing: intOf(fd.get(`missing.${i.id}`)), out: out.get(i.id) ?? 0 }));
  if (rows.some((r) => [r.good, r.damaged, r.missing].some((n) => Number.isNaN(n) || n < 0))) return { error: t.g("જથ્થો સાચો લખો.", "Enter valid quantities.") };
  const over = rows.find((r) => r.good + r.damaged + r.missing > r.out);
  if (over) return { error: t.g(`${over.i.nameGu}: ફક્ત ${over.out} બહાર છે.`, `${over.i.nameGu}: only ${over.out} are out.`) };
  const active = rows.filter((r) => r.good + r.damaged + r.missing > 0);
  if (!active.length) return { error: t.g("પરત આવેલો જથ્થો લખો.", "Enter the quantities that came back.") };
  const charge = fd.get("charge") === "on" && booking.status !== "CANCELLED";
  const actor = actorOf(user);
  const today = dateOnly(todayIST());
  let charged = 0;
  await db.$transaction(async (tx) => {
    let order = booking.lines.length;
    for (const r of active) {
      await tx.$queryRaw`SELECT id FROM "Item" WHERE id = ${r.i.id} FOR UPDATE`;
      const base = { itemId: r.i.id, date: today, bookingId, createdById: user.id, createdByName: user.fullName };
      if (r.good) await tx.stockMovement.create({ data: { ...base, type: "RETURN", qty: r.good } });
      if (r.damaged) await tx.stockMovement.create({ data: { ...base, type: "RETURN_DAMAGED", qty: r.damaged } });
      if (r.missing) await tx.stockMovement.create({ data: { ...base, type: "RETURN_MISSING", qty: r.missing } });
      const bad = r.damaged + r.missing;
      const rate = Number(r.i.chargeRate);
      if (charge && bad > 0 && rate > 0) {
        const parts = [r.damaged ? `${r.damaged} નુકસાન` : "", r.missing ? `${r.missing} ખૂટ્યાં` : ""].filter(Boolean).join(", ");
        await tx.bookingLine.create({ data: { bookingId, kind: "DAMAGE", description: `${r.i.nameGu}: ${parts}`, qty: new Prisma.Decimal(bad), rate: new Prisma.Decimal(rate.toFixed(2)), amount: new Prisma.Decimal((bad * rate).toFixed(2)), sortOrder: ++order } });
        charged += bad * rate;
      }
    }
    await audit(actor, { action: "edit", entity: "booking", entityId: bookingId, docNo: booking.bookingNo, summary: `વસ્તુ પરત: ${active.map((r) => `${r.i.nameGu} ${r.good}${r.damaged ? ` (+${r.damaged} નુકસાન)` : ""}${r.missing ? ` (${r.missing} ખૂટ્યાં)` : ""}`).join(", ")}${charged ? ` · બિલમાં ${inr(charged)} ચાર્જ` : ""}` }, tx);
  });
  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath(`/bookings/${bookingId}/items`);
  return { ok: true, message: charged ? t.g(`પરત નોંધાયું. બિલમાં ${inr(charged)} ચાર્જ ઉમેરાયો.`, `Return recorded. ${inr(charged)} added to the bill.`) : t.g("પરત નોંધાયું.", "Return recorded.") };
}

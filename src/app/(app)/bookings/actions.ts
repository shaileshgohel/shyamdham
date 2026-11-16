"use server";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { actorOf, PermissionError, requirePermission } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { createVoucher, nextDocNo, systemHead } from "@/lib/accounts";
import { findConflicts, loadBooking, SLOTS, summarize } from "@/lib/bookings";
import { dateFromForm, moneyError, moneyFromForm, str } from "@/lib/forms";
import { can } from "@/lib/permissions";
import { getT } from "@/lib/i18n";
import { dateOnly, daysBetween, inr, isYmd, parseAmount, parseAmountOrZero, ymdOf } from "@/lib/money";
import { fmtDate, normalizeMobile, todayIST } from "@/lib/format";
import type { ActionResult } from "@/components/action-form";

const D = (n: number) => new Prisma.Decimal(n.toFixed(2));

async function guard(action: "create" | "edit" | "cancel") {
  try {
    return await requirePermission("bookings", action);
  } catch (e) {
    if (e instanceof PermissionError) return null;
    throw e;
  }
}

export async function saveBookingAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const t = await getT();
  const id = Number(fd.get("id")) || null;
  const user = await guard(id ? "edit" : "create");
  if (!user) return { error: t("forbidden") };

  const hirerName = str(fd, "hirerName", 120);
  if (!hirerName) return { error: t.g("બુકિંગ કરનારનું નામ લખો.", "Enter the hirer's name.") };
  const mob = normalizeMobile(str(fd, "mobile", 20));
  if (mob === "invalid") return { error: t("err_mobile") };
  const familyId = Number(fd.get("familyId")) || null;
  const isMember = !!familyId || fd.get("isMember") === "on";
  const eventType = str(fd, "eventType", 40) ?? "અન્ય";
  const from = String(fd.get("fromDate") ?? "");
  const to = String(fd.get("toDate") ?? "") || from;
  if (!isYmd(from) || !isYmd(to) || to < from) return { error: t.g("તારીખ ખોટી છે: 'સુધી' તારીખ 'થી' તારીખ પછીની હોવી જોઈએ.", "Dates are wrong: the end date must be on or after the start date.") };
  if (daysBetween(from, to) > 31) return { error: t.g("એક બુકિંગ 31 દિવસથી વધુ ન હોઈ શકે.", "One booking cannot be longer than 31 days.") };
  const slot = String(fd.get("slot") ?? "FULL");
  if (!(SLOTS as readonly string[]).includes(slot)) return { error: t("err_form") };
  const facilityIds = fd.getAll("facilityId").map(Number).filter(Boolean);
  if (!facilityIds.length) return { error: t.g("ઓછામાં ઓછી એક સુવિધા પસંદ કરો.", "Choose at least one facility.") };
  const facilities = await db.facility.findMany({ where: { id: { in: facilityIds }, isActive: true } });
  if (facilities.length !== facilityIds.length) return { error: t("err_form") };
  const charges = await db.chargeItem.findMany({ where: { isActive: true } });
  const extras: { item: (typeof charges)[number]; qty: number }[] = [];
  for (const c of charges) {
    const q = Number(String(fd.get(`extra.${c.id}`) ?? "").trim() || 0);
    if (!Number.isFinite(q) || q < 0 || q > 100000) return { error: t.g(`${c.nameGu}: જથ્થો ખોટો છે.`, `${c.nameGu}: quantity is not valid.`) };
    if (q > 0) extras.push({ item: c, qty: q });
  }
  const discount = parseAmountOrZero(fd.get("discount"));
  if (discount == null) return { error: t.g("ડિસ્કાઉન્ટની રકમ ખોટી છે.", "Discount amount is not valid.") };
  const depRaw = String(fd.get("depositAmount") ?? "").trim();
  const deposit = depRaw === "" ? facilities.reduce((n, f) => n + Number(f.deposit), 0) : parseAmountOrZero(depRaw);
  if (deposit == null) return { error: t.g("ડિપોઝિટની રકમ ખોટી છે.", "Deposit amount is not valid.") };
  const guestsN = Number(fd.get("guests")) || null;

  const days = daysBetween(from, to);
  const lines: { kind: string; description: string; qty: number; rate: number; amount: number }[] = [];
  for (const f of facilities.sort((a, b) => a.sortOrder - b.sortOrder)) {
    const rate = Number(isMember ? f.memberRate : f.nonMemberRate);
    lines.push({ kind: "FACILITY", description: `${f.nameGu} ભાડું (${isMember ? "સભ્ય" : "બિન-સભ્ય"} દર)`, qty: days, rate, amount: rate * days });
  }
  for (const e of extras) lines.push({ kind: "EXTRA", description: `${e.item.nameGu} (${e.item.unit})`, qty: e.qty, rate: Number(e.item.rate), amount: Number(e.item.rate) * e.qty });
  if (discount > 0) lines.push({ kind: "DISCOUNT", description: str(fd, "discountNote", 80) ? `ડિસ્કાઉન્ટ: ${str(fd, "discountNote", 80)}` : "ડિસ્કાઉન્ટ", qty: 1, rate: -discount, amount: -discount });
  const gross = lines.reduce((n, l) => n + l.amount, 0);
  if (gross < 0) return { error: t.g("ડિસ્કાઉન્ટ બિલ કરતાં વધુ છે.", "The discount is more than the bill.") };

  const actor = actorOf(user);
  const data = { hirerName, mobile: mob, address: str(fd, "address", 300), familyId, isMember, eventType, fromDate: dateOnly(from), toDate: dateOnly(to), slot, guests: guestsN, notes: str(fd, "notes", 500), depositAmount: D(deposit) };

  const result = await db.$transaction(async (tx) => {
    const conflicts = await findConflicts(tx, facilityIds, from, to, slot, id ?? undefined);
    if (conflicts.length) return { conflicts };
    if (!id) {
      const { no, fy } = await nextDocNo(tx, "WB", dateOnly(from));
      const b = await tx.booking.create({
        data: { ...data, bookingNo: no, fy, createdById: user.id, createdByName: user.fullName, facilities: { create: facilityIds.map((facilityId) => ({ facilityId })) }, lines: { create: lines.map((l, i) => ({ ...l, qty: D(l.qty), rate: D(l.rate), amount: D(l.amount), sortOrder: i })) } },
      });
      await audit(actor, { action: "create", entity: "booking", entityId: b.id, docNo: no, summary: `વાડી બુકિંગ: ${hirerName} · ${fmtDate(dateOnly(from))}${to !== from ? `–${fmtDate(dateOnly(to))}` : ""} · ${facilities.map((f) => f.nameGu).join(", ")} · બિલ ${inr(gross)}` }, tx);
      return { id: b.id };
    }
    const before = await tx.booking.findUniqueOrThrow({ where: { id }, include: { facilities: { include: { facility: true } }, lines: true } });
    if (before.status === "CANCELLED") return { cancelled: true };
    await tx.booking.update({ where: { id }, data });
    await tx.bookingFacility.deleteMany({ where: { bookingId: id } });
    await tx.bookingFacility.createMany({ data: facilityIds.map((facilityId) => ({ bookingId: id, facilityId })) });
    const kept = before.lines.filter((l) => l.kind === "DAMAGE" || l.kind === "MANUAL");
    await tx.bookingLine.deleteMany({ where: { bookingId: id, kind: { in: ["FACILITY", "EXTRA", "DISCOUNT"] } } });
    await tx.bookingLine.createMany({ data: lines.map((l, i) => ({ ...l, bookingId: id, qty: D(l.qty), rate: D(l.rate), amount: D(l.amount), sortOrder: i })) });
    if (kept.length) for (const [i, l] of kept.entries()) await tx.bookingLine.update({ where: { id: l.id }, data: { sortOrder: lines.length + i } });
    const oldTotal = before.lines.reduce((n, l) => n + Number(l.amount), 0);
    const newTotal = gross + kept.reduce((n, l) => n + Number(l.amount), 0);
    const changes: Record<string, [unknown, unknown]> = {};
    const cmp = (k: string, a: unknown, b: unknown) => { if (String(a ?? "") !== String(b ?? "")) changes[k] = [a ?? null, b ?? null]; };
    cmp("નામ", before.hirerName, hirerName); cmp("મોબાઈલ", before.mobile, mob); cmp("પ્રસંગ", before.eventType, eventType);
    cmp("તારીખથી", ymdOf(before.fromDate), from); cmp("તારીખ સુધી", ymdOf(before.toDate), to); cmp("સમય", before.slot, slot);
    cmp("સુવિધા", before.facilities.map((f) => f.facility.nameGu).sort().join(", "), facilities.map((f) => f.nameGu).sort().join(", "));
    cmp("સભ્ય દર", before.isMember, isMember); cmp("ડિપોઝિટ", Number(before.depositAmount), deposit); cmp("બિલ કુલ", oldTotal, newTotal);
    if (Object.keys(changes).length) await audit(actor, { action: "edit", entity: "booking", entityId: id, docNo: before.bookingNo, summary: `બુકિંગ સુધાર્યું: ${hirerName}`, changes }, tx);
    return { id };
  });

  if ("conflicts" in result && result.conflicts) {
    const c = result.conflicts.map((x) => `${x.facility}: ${x.bookingNo} (${x.hirerName}, ${fmtDate(x.fromDate)}${x.toDate.getTime() !== x.fromDate.getTime() ? `–${fmtDate(x.toDate)}` : ""})`).join("; ");
    return { error: t.g(`આ તારીખે સુવિધા પહેલેથી બુક છે — ${c}`, `Already booked on these dates — ${c}`) };
  }
  if ("cancelled" in result) return { error: t.g("રદ થયેલું બુકિંગ સુધારી શકાતું નથી.", "A cancelled booking cannot be edited.") };
  revalidatePath("/bookings");
  return { ok: true, redirect: `/bookings/${result.id}?saved=${id ? "edit" : "new"}` };
}

export async function bookingPaymentAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const t = await getT();
  const user = await guard("edit");
  if (!user) return { error: t("forbidden") };
  const id = Number(fd.get("bookingId"));
  const kind = String(fd.get("kind"));
  const b = await loadBooking(id);
  if (!b || b.status === "CANCELLED") return { error: t.g("બુકિંગ મળ્યું નહીં કે રદ છે.", "Booking not found or cancelled.") };
  const ymd = dateFromForm(fd, "date", can(user.role, "bookings", "edit"));
  if (!ymd) return { error: t.g("તારીખ ખોટી છે.", "The date is not valid.") };
  const m = await moneyFromForm(fd);
  if ("error" in m && m.error) return { error: moneyError(t, m.error) };
  const { account, amount, mode, reference } = m as Exclude<typeof m, { error: string }>;
  const s = summarize(b);
  if (kind === "RENT" && amount > s.balance + 0.001) return { error: t.g(`બાકી રકમ ${inr(s.balance)} છે; તેનાથી વધુ ન લઈ શકાય.`, `Only ${inr(s.balance)} is due; you cannot take more.`) };
  if (kind === "DEPOSIT" && s.depositHeld + amount > s.depositAgreed + 0.001) return { error: t.g(`નક્કી કરેલ ડિપોઝિટ ${inr(s.depositAgreed)} છે.`, `The agreed deposit is ${inr(s.depositAgreed)}.`) };
  const head = kind === "RENT" ? await systemHead(db, String(fd.get("headKey")) === "booking_damage" ? "booking_damage" : "booking_rent") : null;
  const actor = actorOf(user);
  await db.$transaction(async (tx) => {
    const v = await createVoucher(tx, { type: kind === "RENT" ? "INCOME" : "DEPOSIT_IN", date: dateOnly(ymd), headId: head?.id ?? null, accountId: account.id, amount, mode, reference, party: b.hirerName, narration: `${b.bookingNo} · ${kind === "RENT" ? "બિલ પેટે" : "ડિપોઝિટ"}`, source: "BOOKING", bookingId: b.id }, actor);
    await audit(actor, { action: "create", entity: "booking", entityId: b.id, docNo: b.bookingNo, summary: `${kind === "RENT" ? "બિલ પેમેન્ટ" : "ડિપોઝિટ જમા"}: ${inr(amount)} · ${v.voucherNo}` }, tx);
  });
  revalidatePath(`/bookings/${id}`);
  return { ok: true, message: t.g("પેમેન્ટ નોંધાયું.", "Payment recorded.") };
}

export async function settleDepositAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const t = await getT();
  const user = await guard("edit");
  if (!user) return { error: t("forbidden") };
  const id = Number(fd.get("bookingId"));
  const b = await loadBooking(id);
  if (!b) return { error: t("err_form") };
  const s = summarize(b);
  const adjust = parseAmountOrZero(fd.get("adjust"));
  const refund = parseAmountOrZero(fd.get("amount"));
  if (adjust == null || refund == null) return { error: moneyError(t, "amount") };
  if (adjust + refund <= 0) return { error: t.g("પરત અથવા સરભર કરવાની રકમ લખો.", "Enter an amount to return or adjust.") };
  if (adjust + refund > s.depositHeld + 0.001) return { error: t.g(`પાસે ફક્ત ${inr(s.depositHeld)} ડિપોઝિટ છે.`, `Only ${inr(s.depositHeld)} deposit is held.`) };
  if (adjust > Math.max(0, s.balance) + 0.001) return { error: t.g(`બિલમાં બાકી ${inr(Math.max(0, s.balance))} છે; સરભર તેનાથી વધુ ન થાય.`, `Only ${inr(Math.max(0, s.balance))} is due on the bill; you cannot adjust more.`) };
  let refundAcct: { id: number } | null = null, mode = "CASH", reference: string | null = null;
  if (refund > 0) {
    const m = await moneyFromForm(fd);
    if ("error" in m && m.error) return { error: moneyError(t, m.error) };
    const ok = m as Exclude<typeof m, { error: string }>;
    refundAcct = ok.account; mode = ok.mode; reference = ok.reference;
  }
  const date = dateOnly(dateFromForm(fd, "date", true) ?? todayIST());
  const head = await systemHead(db, String(fd.get("headKey")) === "booking_damage" ? "booking_damage" : "booking_rent");
  const actor = actorOf(user);
  // Deposit taken into income: leave the deposit and enter income in the account where the deposit is kept.
  const depAcct = b.vouchers.find((v) => v.type === "DEPOSIT_IN" && v.status === "ACTIVE")?.accountId ?? refundAcct?.id;
  await db.$transaction(async (tx) => {
    if (adjust > 0 && depAcct) {
      await createVoucher(tx, { type: "DEPOSIT_OUT", date, accountId: depAcct, amount: adjust, mode: "ADJUST", party: b.hirerName, narration: `${b.bookingNo} · ડિપોઝિટમાંથી બિલ સરભર`, source: "BOOKING", bookingId: b.id }, actor);
      await createVoucher(tx, { type: "INCOME", date, headId: head.id, accountId: depAcct, amount: adjust, mode: "ADJUST", party: b.hirerName, narration: `${b.bookingNo} · ડિપોઝિટમાંથી સરભર`, source: "BOOKING", bookingId: b.id }, actor);
    }
    if (refund > 0 && refundAcct) await createVoucher(tx, { type: "DEPOSIT_OUT", date, accountId: refundAcct.id, amount: refund, mode, reference, party: b.hirerName, narration: `${b.bookingNo} · ડિપોઝિટ પરત`, source: "BOOKING", bookingId: b.id }, actor);
    await audit(actor, { action: "edit", entity: "booking", entityId: b.id, docNo: b.bookingNo, summary: `ડિપોઝિટ હિસાબ: પરત ${inr(refund)}${adjust ? ` · બિલમાં સરભર ${inr(adjust)}` : ""}` }, tx);
  });
  revalidatePath(`/bookings/${id}`);
  return { ok: true, message: t.g("ડિપોઝિટનો હિસાબ નોંધાયો.", "Deposit settlement recorded.") };
}

export async function addChargeAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const t = await getT();
  const user = await guard("edit");
  if (!user) return { error: t("forbidden") };
  const id = Number(fd.get("bookingId"));
  const b = await db.booking.findUnique({ where: { id }, include: { lines: true } });
  if (!b || b.status === "CANCELLED") return { error: t("err_form") };
  const description = str(fd, "description", 120);
  const qty = Number(fd.get("qty") || 1);
  const rate = parseAmount(fd.get("rate"));
  if (!description || !Number.isFinite(qty) || qty <= 0 || rate == null) return { error: t.g("વિગત, જથ્થો અને દર લખો.", "Enter details, quantity and rate.") };
  const kind = fd.get("kind") === "DAMAGE" ? "DAMAGE" : "MANUAL";
  await db.$transaction(async (tx) => {
    await tx.bookingLine.create({ data: { bookingId: id, kind, description, qty: D(qty), rate: D(rate), amount: D(qty * rate), sortOrder: b.lines.length + 1 } });
    await audit(actorOf(user), { action: "edit", entity: "booking", entityId: id, docNo: b.bookingNo, summary: `બિલમાં ઉમેર્યું: ${description} · ${qty} × ${inr(rate)} = ${inr(qty * rate)}` }, tx);
  });
  revalidatePath(`/bookings/${id}`);
  return { ok: true, message: t.g("બિલમાં ઉમેરાયું.", "Added to the bill.") };
}

export async function removeChargeAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const t = await getT();
  const user = await guard("edit");
  if (!user) return { error: t("forbidden") };
  const lineId = Number(fd.get("lineId"));
  const line = await db.bookingLine.findUnique({ where: { id: lineId }, include: { booking: true } });
  if (!line || !["DAMAGE", "MANUAL"].includes(line.kind) || line.booking.status === "CANCELLED") return { error: t("err_form") };
  await db.$transaction(async (tx) => {
    await tx.bookingLine.delete({ where: { id: lineId } });
    await audit(actorOf(user), { action: "edit", entity: "booking", entityId: line.bookingId, docNo: line.booking.bookingNo, summary: `બિલમાંથી કાઢ્યું: ${line.description} · ${inr(line.amount)}` }, tx);
  });
  revalidatePath(`/bookings/${line.bookingId}`);
  return { ok: true };
}

export async function bookingStatusAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const t = await getT();
  const to = String(fd.get("status"));
  const user = await guard(to === "CANCELLED" ? "cancel" : "edit");
  if (!user) return { error: t("forbidden") };
  const id = Number(fd.get("bookingId"));
  const b = await loadBooking(id);
  if (!b || b.status === "CANCELLED") return { error: t("err_form") };
  const s = summarize(b);
  const reason = str(fd, "reason", 300);
  if (to === "CANCELLED") {
    if (!reason) return { error: t.g("રદ કરવાનું કારણ લખો.", "Give a reason for cancelling.") };
    if (s.depositHeld > 0.001) return { error: t.g(`પહેલાં ${inr(s.depositHeld)} ડિપોઝિટ પરત કરો.`, `Return the ${inr(s.depositHeld)} deposit first.`) };
  } else if (to === "COMPLETED") {
    if (s.balance > 0.001) return { error: t.g(`બિલમાં હજુ ${inr(s.balance)} બાકી છે.`, `${inr(s.balance)} is still due on the bill.`) };
    if (s.depositHeld > 0.001) return { error: t.g(`ડિપોઝિટ ${inr(s.depositHeld)} હજુ પાસે છે; પરત કે સરભર કરો.`, `${inr(s.depositHeld)} deposit is still held; return or adjust it.`) };
    const out = b.movements.reduce((n, m) => n + (m.type === "ISSUE" ? m.qty : ["RETURN", "RETURN_DAMAGED", "RETURN_MISSING"].includes(m.type) ? -m.qty : 0), 0);
    if (out > 0) return { error: t.g(`${out} વસ્તુ હજુ પરત આવી નથી.`, `${out} items have not come back yet.`) };
  } else if (to !== "CONFIRMED") return { error: t("err_form") };
  await db.$transaction(async (tx) => {
    await tx.booking.update({ where: { id }, data: { status: to, ...(to === "CANCELLED" ? { cancelReason: reason, cancelledAt: new Date() } : {}) } });
    await audit(actorOf(user), { action: to === "CANCELLED" ? "cancel" : "edit", entity: "booking", entityId: id, docNo: b.bookingNo, summary: `બુકિંગ ${to === "CANCELLED" ? `રદ · કારણ: ${reason}${s.paid ? ` · ${inr(s.paid)} મળેલ રકમ આવકમાં રહેશે` : ""}` : to === "COMPLETED" ? "પૂરું" : "ફરી ચાલુ"}` }, tx);
  });
  revalidatePath(`/bookings/${id}`);
  revalidatePath("/bookings");
  return { ok: true, message: t("saved") };
}

// ---------- setup: facilities and rate card ----------

export async function saveFacilityAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const t = await getT();
  const user = await guard("edit");
  if (!user) return { error: t("forbidden") };
  const id = Number(fd.get("id")) || null;
  const nameGu = str(fd, "nameGu", 60);
  const nums = ["memberRate", "nonMemberRate", "deposit"].map((k) => parseAmountOrZero(fd.get(k)));
  if (!nameGu || nums.some((n) => n == null)) return { error: t.g("નામ અને દર સાચા લખો.", "Enter a name and valid rates.") };
  const [memberRate, nonMemberRate, deposit] = nums as number[];
  const isActive = fd.get("isActive") !== "0";
  try {
    await db.$transaction(async (tx) => {
      if (id) {
        const before = await tx.facility.findUniqueOrThrow({ where: { id } });
        await tx.facility.update({ where: { id }, data: { nameGu, memberRate: D(memberRate), nonMemberRate: D(nonMemberRate), deposit: D(deposit), isActive } });
        await audit(actorOf(user), { action: "edit", entity: "facility", entityId: id, docNo: nameGu, summary: `સુવિધા / દર સુધાર્યા: ${nameGu}`, changes: { "સભ્ય દર": [Number(before.memberRate), memberRate], "બિન-સભ્ય દર": [Number(before.nonMemberRate), nonMemberRate], ડિપોઝિટ: [Number(before.deposit), deposit], ચાલુ: [before.isActive, isActive] } }, tx);
      } else {
        const f = await tx.facility.create({ data: { nameGu, memberRate: D(memberRate), nonMemberRate: D(nonMemberRate), deposit: D(deposit), sortOrder: 10 } });
        await audit(actorOf(user), { action: "create", entity: "facility", entityId: f.id, docNo: nameGu, summary: `નવી સુવિધા: ${nameGu}` }, tx);
      }
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { error: t.g("આ નામ પહેલેથી છે.", "This name already exists.") };
    throw e;
  }
  revalidatePath("/bookings/setup");
  return { ok: true, message: t("saved") };
}

export async function saveChargeItemAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const t = await getT();
  const user = await guard("edit");
  if (!user) return { error: t("forbidden") };
  const id = Number(fd.get("id")) || null;
  const nameGu = str(fd, "nameGu", 60);
  const unit = str(fd, "unit", 20) ?? "નંગ";
  const rate = parseAmount(fd.get("rate"));
  if (!nameGu || rate == null) return { error: t.g("નામ અને દર સાચા લખો.", "Enter a name and a valid rate.") };
  const isActive = fd.get("isActive") !== "0";
  try {
    await db.$transaction(async (tx) => {
      if (id) {
        const before = await tx.chargeItem.findUniqueOrThrow({ where: { id } });
        await tx.chargeItem.update({ where: { id }, data: { nameGu, unit, rate: D(rate), isActive } });
        await audit(actorOf(user), { action: "edit", entity: "charge_item", entityId: id, docNo: nameGu, summary: `રેટ કાર્ડ સુધાર્યું: ${nameGu}`, changes: { દર: [Number(before.rate), rate], ચાલુ: [before.isActive, isActive] } }, tx);
      } else {
        const c = await tx.chargeItem.create({ data: { nameGu, unit, rate: D(rate), sortOrder: 10 } });
        await audit(actorOf(user), { action: "create", entity: "charge_item", entityId: c.id, docNo: nameGu, summary: `રેટ કાર્ડમાં ઉમેર્યું: ${nameGu} · ${inr(rate)}/${unit}` }, tx);
      }
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { error: t.g("આ નામ પહેલેથી છે.", "This name already exists.") };
    throw e;
  }
  revalidatePath("/bookings/setup");
  return { ok: true, message: t("saved") };
}

"use server";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { actorOf, PermissionError, requirePermission } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { can } from "@/lib/permissions";
import { createVoucher, nextDocNo } from "@/lib/accounts";
import { dateFromForm, moneyError, moneyFromForm, str } from "@/lib/forms";
import { getT } from "@/lib/i18n";
import { dateOnly, inr } from "@/lib/money";
import { normalizeMobile } from "@/lib/format";
import type { ActionResult } from "@/components/action-form";

export async function createDonationAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const t = await getT();
  let user;
  try {
    user = await requirePermission("donations", "create");
  } catch (e) {
    if (e instanceof PermissionError) return { error: t("forbidden") };
    throw e;
  }
  const donorName = str(fd, "donorName", 120);
  if (!donorName) return { error: t.g("દાતાનું નામ લખો.", "Enter the donor's name.") };
  const ymd = dateFromForm(fd, "date", can(user.role, "donations", "edit"));
  if (!ymd) return { error: t.g("તારીખ ખોટી છે (ભવિષ્યની તારીખ ન ચાલે).", "The date is not valid (no future dates).") };
  const money = await moneyFromForm(fd);
  if ("error" in money && money.error) return { error: moneyError(t, money.error) };
  const { mode, account, amount, reference } = money as Exclude<typeof money, { error: string }>;
  const headId = Number(fd.get("headId"));
  const head = await db.accountHead.findUnique({ where: { id: headId } });
  if (!head || head.type !== "INCOME" || !head.isActive) return { error: t.g("હેડ પસંદ કરો.", "Choose a head.") };
  const mob = normalizeMobile(str(fd, "mobile", 20));
  if (mob === "invalid") return { error: t("err_mobile") };
  const pan = str(fd, "pan", 12)?.toUpperCase().replace(/\s/g, "") ?? null;
  if (pan && !/^[A-Z]{5}\d{4}[A-Z]$/.test(pan)) return { error: t("err_pan") };
  const familyId = Number(fd.get("familyId")) || null;

  const date = dateOnly(ymd);
  const actor = actorOf(user);
  const donation = await db.$transaction(async (tx) => {
    const { no, fy } = await nextDocNo(tx, "SD", date);
    const d = await tx.donation.create({
      data: {
        receiptNo: no, fy, date, donorName, familyId, mobile: mob, address: str(fd, "address", 300), pan,
        headId: head.id, amount: new Prisma.Decimal(amount.toFixed(2)), mode, reference, accountId: account.id,
        inMemoryOf: str(fd, "inMemoryOf", 150), notes: str(fd, "notes", 300),
        verifyCode: randomBytes(9).toString("base64url"), createdById: user.id, createdByName: user.fullName,
      },
    });
    await createVoucher(tx, { type: "INCOME", date, headId: head.id, accountId: account.id, amount, mode, reference, party: donorName, narration: d.inMemoryOf ? `સ્મરણાર્થે: ${d.inMemoryOf}` : null, source: "DONATION", donationId: d.id, voucherNo: no }, actor);
    await audit(actor, { action: "create", entity: "donation", entityId: d.id, docNo: no, summary: `દાન રસીદ: ${donorName} · ${inr(amount)} · ${head.nameGu} · ${mode}` }, tx);
    return d;
  });
  revalidatePath("/donations");
  revalidatePath("/dashboard");
  return { ok: true, redirect: `/donations/${donation.id}?new=1` };
}

export async function cancelDonationAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const t = await getT();
  let user;
  try {
    user = await requirePermission("donations", "cancel");
  } catch {
    return { error: t("forbidden") };
  }
  const id = Number(fd.get("id"));
  const reason = str(fd, "reason", 300);
  if (!reason) return { error: t.g("રદ કરવાનું કારણ લખો.", "Give a reason for cancelling.") };
  const d = await db.donation.findUnique({ where: { id }, include: { voucher: true } });
  if (!d || d.status !== "ACTIVE") return { error: t.g("આ રસીદ પહેલેથી રદ છે.", "This receipt is already cancelled.") };
  const now = new Date();
  await db.$transaction(async (tx) => {
    const cancel = { status: "CANCELLED", cancelReason: reason, cancelledAt: now, cancelledById: user.id };
    await tx.donation.update({ where: { id }, data: cancel });
    if (d.voucher) await tx.voucher.update({ where: { id: d.voucher.id }, data: cancel });
    await audit(actorOf(user), { action: "cancel", entity: "donation", entityId: id, docNo: d.receiptNo, summary: `રસીદ રદ: ${d.donorName} · ${inr(d.amount)} · કારણ: ${reason}` }, tx);
  });
  revalidatePath(`/donations/${id}`);
  revalidatePath("/donations");
  return { ok: true, message: t.g("રસીદ રદ થઈ. હિસાબમાંથી પણ રકમ નીકળી ગઈ.", "Receipt cancelled. The amount is removed from the accounts too.") };
}

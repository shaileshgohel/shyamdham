"use server";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { actorOf, PermissionError, requirePermission, requireSuperAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { can } from "@/lib/permissions";
import { createVoucher, VOUCHER_TYPE_GU } from "@/lib/accounts";
import { dateFromForm, moneyError, moneyFromForm, str } from "@/lib/forms";
import { getT } from "@/lib/i18n";
import { dateOnly, inr, isYmd, parseAmount, parseAmountOrZero } from "@/lib/money";
import { SETTING_FIELDS } from "@/lib/settings";
import type { ActionResult } from "@/components/action-form";

const MAX_FILE = 3 * 1024 * 1024;
const FILE_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

async function guard(action: "create" | "edit" | "cancel") {
  try {
    return await requirePermission("accounts", action);
  } catch (e) {
    if (e instanceof PermissionError) return null;
    throw e;
  }
}

export async function createVoucherAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const t = await getT();
  const user = await guard("create");
  if (!user) return { error: t("forbidden") };
  const type = String(fd.get("type"));
  if (!["INCOME", "EXPENSE", "CONTRA"].includes(type)) return { error: t("err_form") };
  const ymd = dateFromForm(fd, "date", can(user.role, "accounts", "edit"));
  if (!ymd) return { error: t.g("તારીખ ખોટી છે (ભવિષ્યની તારીખ ન ચાલે).", "The date is not valid (no future dates).") };

  let headId: number | null = null;
  let accountId: number, toAccountId: number | null = null, amount: number, mode: string, reference: string | null;
  if (type === "CONTRA") {
    accountId = Number(fd.get("accountId"));
    toAccountId = Number(fd.get("toAccountId"));
    const a = parseAmount(fd.get("amount"));
    if (a == null) return { error: moneyError(t, "amount") };
    amount = a;
    if (!accountId || !toAccountId || accountId === toAccountId) return { error: t.g("બે અલગ ખાતાં પસંદ કરો.", "Choose two different accounts.") };
    const [from, to] = await Promise.all([db.moneyAccount.findUnique({ where: { id: accountId } }), db.moneyAccount.findUnique({ where: { id: toAccountId } })]);
    if (!from?.isActive || !to?.isActive) return { error: moneyError(t, "account") };
    mode = from.kind === "CASH" || to.kind === "CASH" ? "CASH" : "BANK";
    reference = str(fd, "reference", 60);
  } else {
    const m = await moneyFromForm(fd);
    if ("error" in m && m.error) return { error: moneyError(t, m.error) };
    const ok = m as Exclude<typeof m, { error: string }>;
    accountId = ok.account.id; amount = ok.amount; mode = ok.mode; reference = ok.reference;
    headId = Number(fd.get("headId"));
    const head = await db.accountHead.findUnique({ where: { id: headId } });
    if (!head || head.type !== type || !head.isActive) return { error: t.g("હેડ પસંદ કરો.", "Choose a head.") };
  }
  const party = str(fd, "party", 120);
  const narration = str(fd, "narration", 300);
  if (type === "EXPENSE" && !party) return { error: t.g("કોને ચૂકવ્યા તે લખો.", "Enter who was paid.") };

  let attachment: { data: Buffer; type: string; name: string } | null = null;
  const file = fd.get("attachment");
  if (file instanceof File && file.size) {
    if (file.size > MAX_FILE || !FILE_TYPES.includes(file.type)) return { error: t.g("બિલનો ફોટો JPG, PNG અથવા PDF અને 3 MB થી નાનો હોવો જોઈએ.", "The bill photo must be JPG, PNG or PDF and under 3 MB.") };
    attachment = { data: Buffer.from(await file.arrayBuffer()), type: file.type, name: file.name.slice(0, 120) };
  }

  const actor = actorOf(user);
  const v = await db.$transaction(async (tx) => {
    const v = await createVoucher(tx, { type: type as "INCOME" | "EXPENSE" | "CONTRA", date: dateOnly(ymd), headId, accountId, toAccountId, amount, mode, reference, party, narration, attachment }, actor);
    await audit(actor, { action: "create", entity: "voucher", entityId: v.id, docNo: v.voucherNo, summary: `${VOUCHER_TYPE_GU[type]} વાઉચર: ${inr(amount)}${party ? ` · ${party}` : ""}${narration ? ` · ${narration}` : ""}` }, tx);
    return v;
  });
  revalidatePath("/accounts");
  return { ok: true, redirect: `/accounts/vouchers/${v.id}?new=1` };
}

export async function cancelVoucherAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const t = await getT();
  const user = await guard("cancel");
  if (!user) return { error: t("forbidden") };
  const id = Number(fd.get("id"));
  const reason = str(fd, "reason", 300);
  if (!reason) return { error: t.g("રદ કરવાનું કારણ લખો.", "Give a reason for cancelling.") };
  const v = await db.voucher.findUnique({ where: { id } });
  if (!v || v.status !== "ACTIVE") return { error: t.g("આ વાઉચર પહેલેથી રદ છે.", "This voucher is already cancelled.") };
  if (v.source !== "MANUAL") return { error: t.g("આ એન્ટ્રી દાન રસીદ કે બુકિંગમાંથી આવી છે; ત્યાંથી રદ કરો.", "This entry comes from a donation or booking; cancel it there.") };
  await db.$transaction(async (tx) => {
    await tx.voucher.update({ where: { id }, data: { status: "CANCELLED", cancelReason: reason, cancelledAt: new Date(), cancelledById: user.id } });
    await audit(actorOf(user), { action: "cancel", entity: "voucher", entityId: id, docNo: v.voucherNo, summary: `વાઉચર રદ: ${inr(v.amount)} · કારણ: ${reason}` }, tx);
  });
  revalidatePath(`/accounts/vouchers/${id}`);
  return { ok: true, message: t.g("વાઉચર રદ થયું.", "Voucher cancelled.") };
}

// ---------- setup ----------

export async function saveHeadAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const t = await getT();
  const user = await guard("edit");
  if (!user) return { error: t("forbidden") };
  const id = Number(fd.get("id")) || null;
  const nameGu = str(fd, "nameGu", 60);
  const nameEn = str(fd, "nameEn", 60);
  const type = String(fd.get("type"));
  const isActive = fd.get("isActive") !== "0";
  if (!nameGu || !["INCOME", "EXPENSE"].includes(type)) return { error: t.g("હેડનું નામ લખો.", "Enter the head name.") };
  try {
    if (id) {
      const before = await db.accountHead.findUniqueOrThrow({ where: { id } });
      if (before.systemKey && !isActive) return { error: t.g("આ હેડ દાન/બુકિંગ માટે જરૂરી છે, બંધ ન થાય.", "This head is used by donations or bookings and cannot be switched off.") };
      await db.$transaction(async (tx) => {
        await tx.accountHead.update({ where: { id }, data: { nameGu, nameEn, isActive } });
        await audit(actorOf(user), { action: "edit", entity: "account_head", entityId: id, docNo: nameGu, summary: `હેડ સુધાર્યો: ${nameGu}`, changes: { નામ: [before.nameGu, nameGu], ચાલુ: [before.isActive, isActive] } }, tx);
      });
    } else {
      const max = await db.accountHead.aggregate({ where: { type }, _max: { sortOrder: true } });
      await db.$transaction(async (tx) => {
        const h = await tx.accountHead.create({ data: { type, nameGu, nameEn, sortOrder: (max._max.sortOrder ?? 0) + 1 } });
        await audit(actorOf(user), { action: "create", entity: "account_head", entityId: h.id, docNo: nameGu, summary: `નવો ${type === "INCOME" ? "આવક" : "જાવક"} હેડ: ${nameGu}` }, tx);
      });
    }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { error: t.g("આ નામનો હેડ પહેલેથી છે.", "A head with this name already exists.") };
    throw e;
  }
  revalidatePath("/accounts/setup");
  return { ok: true, message: t("saved") };
}

export async function saveMoneyAccountAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const t = await getT();
  const user = await guard("edit");
  if (!user) return { error: t("forbidden") };
  const id = Number(fd.get("id")) || null;
  const name = str(fd, "name", 60);
  const kind = String(fd.get("kind"));
  const bankDetails = str(fd, "bankDetails", 120);
  const openingDate = String(fd.get("openingDate") ?? "");
  const opening = parseAmountOrZero(fd.get("openingBalance"));
  const isActive = fd.get("isActive") !== "0";
  if (!name || !["CASH", "BANK"].includes(kind) || !isYmd(openingDate)) return { error: t("err_form") };
  if (opening == null) return { error: moneyError(t, "amount") };
  const data = { name, kind, bankDetails, openingDate: dateOnly(openingDate), openingBalance: new Prisma.Decimal(opening.toFixed(2)), isActive };
  try {
    await db.$transaction(async (tx) => {
      if (id) {
        const before = await tx.moneyAccount.findUniqueOrThrow({ where: { id } });
        await tx.moneyAccount.update({ where: { id }, data });
        await audit(actorOf(user), {
          action: "edit", entity: "money_account", entityId: id, docNo: name, summary: `ખાતું સુધાર્યું: ${name}`,
          changes: { નામ: [before.name, name], "ઉઘડતી સિલક": [Number(before.openingBalance), opening], "સિલકની તારીખ": [before.openingDate.toISOString().slice(0, 10), openingDate], ચાલુ: [before.isActive, isActive] },
        }, tx);
      } else {
        const a = await tx.moneyAccount.create({ data: { ...data, sortOrder: 10 } });
        await audit(actorOf(user), { action: "create", entity: "money_account", entityId: a.id, docNo: name, summary: `નવું ખાતું: ${name} · ઉઘડતી સિલક ${inr(opening)}` }, tx);
      }
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { error: t.g("આ નામનું ખાતું પહેલેથી છે.", "An account with this name already exists.") };
    throw e;
  }
  revalidatePath("/accounts/setup");
  return { ok: true, message: t("saved") };
}

export async function saveSettingsAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const t = await getT();
  let user;
  try {
    user = await requireSuperAdmin();
  } catch {
    return { error: t("forbidden") };
  }
  const before = Object.fromEntries((await db.setting.findMany()).map((s) => [s.key, s.value]));
  const changes: Record<string, [unknown, unknown]> = {};
  await db.$transaction(async (tx) => {
    for (const f of SETTING_FIELDS) {
      const v = String(fd.get(f.key) ?? "").trim().slice(0, 600);
      const old = before[f.key] ?? f.default;
      if (v !== old) changes[f.gu] = [old, v];
      await tx.setting.upsert({ where: { key: f.key }, create: { key: f.key, value: v }, update: { value: v } });
    }
    if (Object.keys(changes).length) await audit(actorOf(user), { action: "edit", entity: "setting", summary: "સંસ્થાની વિગત સુધારી", changes }, tx);
  });
  return { ok: true, message: t("saved") };
}

"use server";
import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { actorOf, hashPassword, PermissionError, requirePermission, type CurrentUser } from "@/lib/auth";
import { audit, diff } from "@/lib/audit";
import { normalizeMobile } from "@/lib/format";
import type { DictKey } from "@/lib/i18n-dict";

export type UserFormState = { ok?: boolean; error?: DictKey; fieldErrors?: Record<string, DictKey>; userId?: number; tempPassword?: string; username?: string };

function tempPassword() {
  const letters = "abcdefghjkmnpqrstuvwxyz";
  const pick = () => letters[randomInt(letters.length)];
  return `Sd${randomInt(1000, 9999)}${pick()}${pick()}${pick()}`;
}

const userSchema = z.object({
  fullName: z.string().trim().min(2).max(80),
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9._]{3,30}$/),
  mobile: z.string().trim().max(20).optional(),
  roleId: z.coerce.number().int().positive(),
  isActive: z.boolean(),
});

async function guard(action: "create" | "edit") {
  try {
    return { user: await requirePermission("users", action) };
  } catch (e) {
    if (e instanceof PermissionError) return { error: "forbidden" as const };
    throw e;
  }
}

/** Only a Super Admin may grant the Super Admin role or change a Super Admin's account. */
async function roleAllowed(actor: CurrentUser, roleId: number) {
  const role = await db.role.findUnique({ where: { id: roleId } });
  if (!role) return null;
  if (role.isSuperAdmin && !actor.role.isSuperAdmin) return null;
  return role;
}

export async function createUserAction(_p: UserFormState, form: FormData): Promise<UserFormState> {
  const g = await guard("create");
  if ("error" in g) return { error: g.error };
  const parsed = userSchema.safeParse({
    fullName: form.get("fullName"), username: form.get("username"), mobile: form.get("mobile") || undefined,
    roleId: form.get("roleId"), isActive: true,
  });
  if (!parsed.success) {
    const fe: Record<string, DictKey> = {};
    for (const i of parsed.error.issues) fe[String(i.path[0])] = i.path[0] === "username" ? "err_username" : "required";
    return { error: "err_form", fieldErrors: fe };
  }
  const d = parsed.data;
  const mobile = normalizeMobile(d.mobile);
  if (mobile === "invalid") return { error: "err_form", fieldErrors: { mobile: "err_mobile" } };
  const role = await roleAllowed(g.user, d.roleId);
  if (!role) return { error: "forbidden" };
  if (await db.user.findUnique({ where: { username: d.username } })) return { error: "err_form", fieldErrors: { username: "err_username_taken" } };

  const pw = tempPassword();
  const created = await db.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: { fullName: d.fullName, username: d.username, mobile, roleId: role.id, passwordHash: await hashPassword(pw), mustChangePassword: true },
    });
    await audit(actorOf(g.user), { action: "create", entity: "user", entityId: u.id, docNo: u.username, summary: `નવો યુઝર: ${u.fullName} · રોલ: ${role.nameGu}` }, tx);
    return u;
  });
  revalidatePath("/users");
  return { ok: true, userId: created.id, tempPassword: pw, username: created.username };
}

export async function updateUserAction(_p: UserFormState, form: FormData): Promise<UserFormState> {
  const g = await guard("edit");
  if ("error" in g) return { error: g.error };
  const id = Number(form.get("id"));
  const target = await db.user.findUnique({ where: { id }, include: { role: true } });
  if (!target) return { error: "err_form" };
  if (target.role.isSuperAdmin && !g.user.role.isSuperAdmin) return { error: "forbidden" };

  const parsed = userSchema.safeParse({
    fullName: form.get("fullName"), username: target.username, mobile: form.get("mobile") || undefined,
    roleId: form.get("roleId"), isActive: form.get("isActive") === "on",
  });
  if (!parsed.success) return { error: "err_form", fieldErrors: { fullName: "required" } };
  const d = parsed.data;
  const mobile = normalizeMobile(d.mobile);
  if (mobile === "invalid") return { error: "err_form", fieldErrors: { mobile: "err_mobile" } };
  const role = await roleAllowed(g.user, d.roleId);
  if (!role) return { error: "forbidden" };

  const isSelf = target.id === g.user.id;
  if (isSelf && (!d.isActive || d.roleId !== target.roleId)) return { error: "err_self_lockout" };
  if (target.role.isSuperAdmin && (!d.isActive || !role.isSuperAdmin)) {
    const others = await db.user.count({ where: { isActive: true, role: { isSuperAdmin: true }, id: { not: target.id } } });
    if (others === 0) return { error: "err_last_admin" };
  }

  const after = { fullName: d.fullName, mobile, roleId: role.id, isActive: d.isActive };
  const changes = diff(target, after, ["fullName", "mobile", "roleId", "isActive"]);
  if (changes.roleId) changes.roleId = [target.role.nameGu, role.nameGu];
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: after });
    if (!d.isActive) await tx.session.deleteMany({ where: { userId: id } }); // sign them out everywhere
    if (Object.keys(changes).length)
      await audit(actorOf(g.user), { action: "edit", entity: "user", entityId: id, docNo: target.username, summary: `યુઝર સુધાર્યો: ${d.fullName}`, changes }, tx);
  });
  revalidatePath("/users");
  return { ok: true, userId: id };
}

export async function resetPasswordAction(_p: UserFormState, form: FormData): Promise<UserFormState> {
  const g = await guard("edit");
  if ("error" in g) return { error: g.error };
  const id = Number(form.get("id"));
  const target = await db.user.findUnique({ where: { id }, include: { role: true } });
  if (!target) return { error: "err_form" };
  if (target.role.isSuperAdmin && !g.user.role.isSuperAdmin) return { error: "forbidden" };
  const pw = tempPassword();
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { passwordHash: await hashPassword(pw), mustChangePassword: true, failedLogins: 0, lockedUntil: null } });
    await tx.session.deleteMany({ where: { userId: id } });
    await audit(actorOf(g.user), { action: "password_reset", entity: "user", entityId: id, docNo: target.username, summary: `પાસવર્ડ રીસેટ: ${target.fullName}` }, tx);
  });
  return { ok: true, tempPassword: pw, username: target.username };
}

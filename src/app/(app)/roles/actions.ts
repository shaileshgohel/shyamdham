"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { actorOf, PermissionError, requireSuperAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { ACTIONS, MODULES, sanitizePermissions, type PermissionMap } from "@/lib/permissions";
import type { DictKey } from "@/lib/i18n-dict";

export type RoleState = { ok?: boolean; error?: DictKey };

export async function saveRoleAction(_p: RoleState, form: FormData): Promise<RoleState> {
  let user;
  try {
    user = await requireSuperAdmin();
  } catch (e) {
    if (e instanceof PermissionError) return { error: "forbidden" };
    throw e;
  }
  const idRaw = String(form.get("id") ?? "");
  const nameGu = String(form.get("nameGu") ?? "").trim().slice(0, 40);
  const nameEn = String(form.get("nameEn") ?? "").trim().slice(0, 40) || nameGu;
  if (!nameGu) return { error: "required" };

  const perms: Record<string, string[]> = {};
  for (const m of MODULES) for (const a of ACTIONS) if (form.get(`p.${m.key}.${a.key}`) === "on") (perms[m.key] ??= []).push(a.key);
  const permissions = sanitizePermissions(perms);

  if (idRaw === "new") {
    const key = `custom_${Date.now().toString(36)}`;
    const role = await db.$transaction(async (tx) => {
      const r = await tx.role.create({ data: { key, nameGu, nameEn, permissions } });
      await audit(actorOf(user), { action: "create", entity: "role", entityId: r.id, docNo: nameGu, summary: `નવો રોલ: ${nameGu}`, changes: { અધિકાર: [null, describe(permissions)] } }, tx);
      return r;
    });
    revalidatePath("/roles");
    redirect(`/roles/${role.id}?saved=1`);
  }

  const id = Number(idRaw);
  const before = await db.role.findUnique({ where: { id } });
  if (!before) return { error: "required" };
  if (before.isSuperAdmin) return { error: "forbidden" }; // the Super Admin role always has every right
  const oldDesc = describe(before.permissions as PermissionMap);
  const newDesc = describe(permissions);
  await db.$transaction(async (tx) => {
    await tx.role.update({ where: { id }, data: { nameGu, nameEn, permissions } });
    const changes: Record<string, [unknown, unknown]> = {};
    if (before.nameGu !== nameGu) changes["નામ"] = [before.nameGu, nameGu];
    if (oldDesc !== newDesc) changes["અધિકાર"] = [oldDesc, newDesc];
    if (Object.keys(changes).length) await audit(actorOf(user), { action: "edit", entity: "role", entityId: id, docNo: nameGu, summary: `રોલના અધિકાર બદલ્યા: ${nameGu}`, changes }, tx);
  });
  revalidatePath("/roles");
  return { ok: true };
}

function describe(p: PermissionMap) {
  return MODULES.map((m) => {
    const a = p[m.key];
    return a?.length ? `${m.gu}: ${a.map((x) => ACTIONS.find((y) => y.key === x)?.gu).join("/")}` : null;
  })
    .filter(Boolean)
    .join("; ") || "—";
}

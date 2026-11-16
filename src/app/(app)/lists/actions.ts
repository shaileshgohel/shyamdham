"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actorOf, requirePermission } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { MASTER_TYPES, type MasterType } from "@/lib/format";

export async function addMasterValueAction(form: FormData) {
  const user = await requirePermission("members", "edit");
  const type = String(form.get("type")) as MasterType;
  const value = String(form.get("value") ?? "").trim().slice(0, 60);
  if (!MASTER_TYPES.includes(type) || !value) return;
  const exists = await db.masterValue.findUnique({ where: { type_value: { type, value } } });
  if (exists) return;
  const max = await db.masterValue.aggregate({ where: { type }, _max: { sortOrder: true } });
  await db.$transaction(async (tx) => {
    const row = await tx.masterValue.create({ data: { type, value, sortOrder: (max._max.sortOrder ?? 0) + 1 } });
    await audit(actorOf(user), { action: "create", entity: "master_value", entityId: row.id, summary: `યાદીમાં ઉમેર્યું (${type}): ${value}` }, tx);
  });
  revalidatePath("/lists");
}

export async function removeMasterValueAction(form: FormData) {
  const user = await requirePermission("members", "edit");
  const id = Number(form.get("id"));
  const row = await db.masterValue.findUnique({ where: { id } });
  if (!row) return;
  // Removing from the pick-list does not change any family already saved with this value.
  await db.$transaction(async (tx) => {
    await tx.masterValue.delete({ where: { id } });
    await audit(actorOf(user), { action: "cancel", entity: "master_value", entityId: id, summary: `યાદીમાંથી કાઢ્યું (${row.type}): ${row.value}` }, tx);
  });
  revalidatePath("/lists");
}

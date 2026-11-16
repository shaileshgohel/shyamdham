"use server";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { db, formatFamilyNo, nextCounter } from "@/lib/db";
import { actorOf, getCurrentUser, PermissionError, requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { audit, diff } from "@/lib/audit";
import { fullName } from "@/lib/format";
import {
  cleanMembers,
  familyInput,
  FAMILY_AUDIT_FIELDS,
  headMobileOwner,
  MEMBER_AUDIT_FIELDS,
  type FieldErrors,
} from "@/lib/members";
import type { DictKey } from "@/lib/i18n-dict";

export type SaveFamilyState = {
  ok?: boolean;
  error?: DictKey;
  errorVars?: Record<string, string>;
  fieldErrors?: FieldErrors;
  familyId?: number;
  familyNo?: string;
};

export async function saveFamilyAction(_prev: SaveFamilyState, form: FormData): Promise<SaveFamilyState> {
  // Reject anyone without member rights before reading or validating the submitted data.
  const caller = await getCurrentUser();
  if (!caller || caller.mustChangePassword || !(can(caller.role, "members", "create") || can(caller.role, "members", "edit"))) {
    return { error: "forbidden" };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(String(form.get("payload") ?? "{}"));
  } catch {
    return { error: "err_form" };
  }
  const parsed = familyInput.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: FieldErrors = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path.join(".")] = "required";
    return { error: "err_form", fieldErrors };
  }
  const input = parsed.data;
  const isEdit = !!input.id;

  let user;
  try {
    user = await requirePermission("members", isEdit ? "edit" : "create");
  } catch (e) {
    if (e instanceof PermissionError) return { error: "forbidden" };
    throw e;
  }

  const { clean, errors } = cleanMembers(input.members);
  if (Object.keys(errors).length) return { error: "err_form", fieldErrors: errors };

  const headIndex = Math.min(input.headIndex, clean.length - 1);
  const head = clean[headIndex];
  if (head.mobile) {
    const owner = await headMobileOwner(head.mobile, input.id);
    if (owner) {
      return {
        error: "err_dup_mobile",
        errorVars: { no: owner.family.familyNo, name: fullName(owner) },
        fieldErrors: { [`members.${headIndex}.mobile`]: "err_mobile" },
      };
    }
  }

  const familyData = {
    address: input.address,
    area: input.area,
    vatan: input.vatan,
    city: input.city,
    membershipType: input.membershipType,
    notes: input.notes,
  };
  const actor = actorOf(user);

  try {
    const result = await db.$transaction(async (tx) => {
      if (!isEdit) {
        const familyNo = formatFamilyNo(await nextCounter(tx, "family"));
        const family = await tx.family.create({
          data: {
            ...familyData,
            familyNo,
            createdById: user.id,
            members: { create: clean.map(({ id: _id, ...m }, i) => ({ ...m, isHead: i === headIndex, sortOrder: i })) },
          },
        });
        await audit(
          actor,
          {
            action: "create",
            entity: "family",
            entityId: family.id,
            docNo: familyNo,
            summary: `નવો પરિવાર: ${fullName(head)} (${clean.length} સભ્ય)`,
          },
          tx,
        );
        return { familyId: family.id, familyNo };
      }

      const before = await tx.family.findUnique({ where: { id: input.id! }, include: { members: true } });
      if (!before) throw new Error("not found");
      const changes: Record<string, [unknown, unknown]> = diff(before, familyData, [...FAMILY_AUDIT_FIELDS]);
      await tx.family.update({ where: { id: before.id }, data: familyData });

      const keepIds = new Set(clean.map((m) => m.id).filter(Boolean) as number[]);
      for (const old of before.members) {
        if (!keepIds.has(old.id)) {
          await tx.member.delete({ where: { id: old.id } });
          changes[`સભ્ય કાઢ્યા: ${fullName(old)}`] = [old.relation, null];
        }
      }
      // Clear the old head flag first so the unique head-mobile index never sees two heads.
      await tx.member.updateMany({ where: { familyId: before.id }, data: { isHead: false } });
      for (const [i, m] of clean.entries()) {
        const { id, ...data } = m;
        const row = { ...data, isHead: i === headIndex, sortOrder: i };
        const old = id ? before.members.find((x) => x.id === id) : undefined;
        if (old) {
          const d = diff(old, row, [...MEMBER_AUDIT_FIELDS]);
          for (const [k, v] of Object.entries(d)) changes[`${fullName(old)} · ${k}`] = v;
          await tx.member.update({ where: { id: old.id }, data: row });
        } else {
          await tx.member.create({ data: { ...row, familyId: before.id } });
          changes[`નવો સભ્ય: ${fullName(m)}`] = [null, m.relation];
        }
      }
      if (Object.keys(changes).length) {
        await audit(
          actor,
          {
            action: "edit",
            entity: "family",
            entityId: before.id,
            docNo: before.familyNo,
            summary: `પરિવાર સુધાર્યો: ${fullName(head)} (${Object.keys(changes).length} ફેરફાર)`,
            changes,
          },
          tx,
        );
      }
      return { familyId: before.id, familyNo: before.familyNo };
    });
    revalidatePath("/members");
    return { ok: true, ...result };
  } catch (e) {
    // Two people saving the same head mobile at the same moment: the database index catches it.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "err_dup_mobile", errorVars: { no: "—", name: "—" } };
    }
    throw e;
  }
}

export type ActiveState = { ok?: boolean; error?: DictKey };

export async function setFamilyActiveAction(_p: ActiveState, form: FormData): Promise<ActiveState> {
  const id = Number(form.get("familyId"));
  const active = form.get("active") === "1";
  const reason = String(form.get("reason") ?? "").trim().slice(0, 300);
  let user;
  try {
    user = await requirePermission("members", "cancel");
  } catch {
    return { error: "forbidden" };
  }
  if (!active && !reason) return { error: "required" };
  const fam = await db.family.findUnique({ where: { id }, include: { members: { where: { isHead: true } } } });
  if (!fam) return { error: "err_form" };
  await db.$transaction(async (tx) => {
    await tx.family.update({ where: { id }, data: { isActive: active } });
    await audit(
      actorOf(user),
      {
        action: active ? "restore" : "cancel",
        entity: "family",
        entityId: id,
        docNo: fam.familyNo,
        summary: `${active ? "પરિવાર ફરી ચાલુ" : "પરિવાર બંધ"}: ${fam.members[0] ? fullName(fam.members[0]) : ""}${reason ? ` · કારણ: ${reason}` : ""}`,
      },
      tx,
    );
  });
  revalidatePath(`/members/${id}`);
  revalidatePath("/members");
  return { ok: true };
}

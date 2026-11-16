"use server";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { db, formatFamilyNo, nextCounter } from "@/lib/db";
import { actorOf, PermissionError, requirePermission } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { getLang } from "@/lib/i18n";
import { readMemberSheet } from "@/lib/excel";
import { planImport, type ImportProblem } from "@/lib/import";
import { cleanMembers, familyInput, type CleanMember, type FamilyInput } from "@/lib/members";
import { fullName } from "@/lib/format";
import type { DictKey } from "@/lib/i18n-dict";

export type ImportState = {
  error?: DictKey;
  fileName?: string;
  problems?: ImportProblem[];
  preview?: { familyCount: number; memberCount: number; sample: { name: string; members: number; area: string | null }[] };
  payload?: string; // validated families, sent back on confirm and validated again
  done?: { families: number; members: number };
};

const MAX_BYTES = 4 * 1024 * 1024;

export async function checkImportAction(_p: ImportState, form: FormData): Promise<ImportState> {
  try {
    await requirePermission("members", "create");
  } catch (e) {
    if (e instanceof PermissionError) return { error: "forbidden" };
    throw e;
  }
  const file = form.get("file");
  if (!(file instanceof File) || !file.size || file.size > MAX_BYTES || !/\.(xlsx|csv)$/i.test(file.name)) return { error: "import_bad_file" };
  let rows;
  try {
    rows = await readMemberSheet(await file.arrayBuffer(), file.name);
  } catch {
    return { error: "import_bad_file" };
  }
  if (!rows.length) return { error: "import_bad_file", fileName: file.name };
  const plan = await planImport(rows, await getLang());
  return {
    fileName: file.name,
    problems: plan.problems,
    preview: {
      familyCount: plan.families.length,
      memberCount: plan.memberCount,
      sample: plan.families.slice(0, 8).map((f) => ({ name: fullName({ firstName: f.members[0].firstName, fatherName: f.members[0].fatherName, surname: f.members[0].surname }), members: f.members.length, area: f.area ?? null })),
    },
    payload: plan.problems.length ? undefined : JSON.stringify(plan.families),
  };
}

export async function commitImportAction(_p: ImportState, form: FormData): Promise<ImportState> {
  let user;
  try {
    user = await requirePermission("members", "create");
  } catch (e) {
    if (e instanceof PermissionError) return { error: "forbidden" };
    throw e;
  }
  let list: unknown;
  try {
    list = JSON.parse(String(form.get("payload") ?? "[]"));
  } catch {
    return { error: "import_bad_file" };
  }
  if (!Array.isArray(list) || !list.length || list.length > 5000) return { error: "import_bad_file" };
  const families: (FamilyInput & { clean: CleanMember[] })[] = [];
  for (const item of list) {
    const p = familyInput.safeParse(item);
    if (!p.success) return { error: "import_bad_file" };
    const { clean, errors } = cleanMembers(p.data.members);
    if (Object.keys(errors).length) return { error: "import_bad_file" };
    families.push({ ...p.data, clean });
  }
  const fileName = String(form.get("fileName") ?? "").slice(0, 120);
  const actor = actorOf(user);
  let memberCount = 0;
  try {
    await db.$transaction(
      async (tx) => {
        for (const f of families) {
          const familyNo = formatFamilyNo(await nextCounter(tx, "family"));
          const fam = await tx.family.create({
            data: {
              familyNo, address: f.address, area: f.area, vatan: f.vatan, city: f.city, membershipType: f.membershipType, createdById: user.id,
              members: { create: f.clean.map(({ id: _id, ...m }, i) => ({ ...m, isHead: i === 0, sortOrder: i })) },
            },
          });
          memberCount += f.clean.length;
          await audit(actor, { action: "import", entity: "family", entityId: fam.id, docNo: familyNo, summary: `Excel આયાત: ${fullName(f.clean[0])} (${f.clean.length} સભ્ય)` }, tx);
        }
        await audit(actor, { action: "import", entity: "member", summary: `Excel આયાત પૂર્ણ: ${families.length} પરિવાર, ${memberCount} સભ્યો · ${fileName}` }, tx);
      },
      { timeout: 120_000 },
    );
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { error: "err_dup_mobile" };
    throw e;
  }
  revalidatePath("/members");
  return { done: { families: families.length, members: memberCount } };
}

"use server";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { actorOf, getCurrentUser, hashPassword, passwordProblem } from "@/lib/auth";
import { audit } from "@/lib/audit";
import type { DictKey } from "@/lib/i18n-dict";

export type CpState = { error?: DictKey };

export async function changePasswordAction(_p: CpState, form: FormData): Promise<CpState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  const full = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await bcrypt.compare(current, full.passwordHash))) return { error: "password_wrong_current" };
  const problem = passwordProblem(next);
  if (problem) return { error: problem as DictKey };
  if (next !== confirm) return { error: "password_mismatch" };

  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next), mustChangePassword: false } });
    await audit(actorOf(user), { action: "password_change", entity: "user", entityId: user.id, summary: "પોતાનો પાસવર્ડ બદલ્યો" }, tx);
  });
  redirect("/dashboard?pw=1");
}

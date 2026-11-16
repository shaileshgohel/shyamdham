import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { cache } from "react";
import { db } from "./db";
import { can, canReadAudit, type ActionKey, type ModuleKey } from "./permissions";
import { audit, describeDevice } from "./audit";

export const SESSION_COOKIE = "sd_session";
const SESSION_DAYS = 7;
const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

let dummyHash: string | null = null;
const getDummyHash = () => (dummyHash ??= bcrypt.hashSync("not-a-real-password", 12));

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 12);
}

export function passwordProblem(pw: string): string | null {
  if (pw.length < 8) return "password_too_short";
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return "password_needs_letter_digit";
  return null;
}

export type LoginResult = { ok: true } | { ok: false; error: "invalid" | "locked" | "inactive" };

export async function login(username: string, password: string): Promise<LoginResult> {
  const uname = username.trim().toLowerCase();
  const user = await db.user.findUnique({ where: { username: uname } });

  if (!user) {
    // Same work as a real check, so response time does not reveal which usernames exist.
    await bcrypt.compare(password, getDummyHash());
    await audit(null, { action: "login_failed", entity: "session", summary: `અજાણ્યું યુઝરનેમ: ${uname.slice(0, 40)}` });
    return { ok: false, error: "invalid" };
  }
  const actor = { id: user.id, fullName: user.fullName };
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await audit(actor, { action: "login_failed", entity: "session", summary: "લૉક થયેલ ખાતામાં લોગિન પ્રયાસ" });
    return { ok: false, error: "locked" };
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    const failed = user.failedLogins + 1;
    const lock = failed >= MAX_FAILED;
    await db.user.update({
      where: { id: user.id },
      data: {
        failedLogins: lock ? 0 : failed,
        lockedUntil: lock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
      },
    });
    await audit(actor, {
      action: "login_failed",
      entity: "session",
      summary: lock ? `ખોટો પાસવર્ડ, ${LOCK_MINUTES} મિનિટ માટે ખાતું લૉક` : `ખોટો પાસવર્ડ (${failed}/${MAX_FAILED})`,
    });
    return { ok: false, error: lock ? "locked" : "invalid" };
  }
  if (!user.isActive) {
    await audit(actor, { action: "login_failed", entity: "session", summary: "બંધ કરેલ ખાતામાં લોગિન પ્રયાસ" });
    return { ok: false, error: "inactive" };
  }

  const token = randomBytes(32).toString("base64url");
  const h = await headers();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.$transaction(async (tx) => {
    await tx.session.create({
      data: {
        tokenHash: sha256(token),
        userId: user.id,
        expiresAt,
        ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
        userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
      },
    });
    await tx.user.update({
      where: { id: user.id },
      data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
    await audit(actor, { action: "login", entity: "session", summary: "લોગિન" }, tx);
  });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
  return { ok: true };
}

export async function logout() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const s = await db.session.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
    if (s) {
      await db.session.delete({ where: { id: s.id } });
      await audit({ id: s.user.id, fullName: s.user.fullName }, { action: "logout", entity: "session", summary: "લોગઆઉટ" });
    }
  }
  jar.delete(SESSION_COOKIE);
}

/** The signed-in user for this request, or null. Cached per request. */
export const getCurrentUser = cache(async () => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const s = await db.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { include: { role: true } } },
  });
  if (!s || s.expiresAt < new Date() || !s.user.isActive) return null;
  const { passwordHash: _omit, ...user } = s.user;
  return user;
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/** For pages: signed in and password already changed, or redirect. */
export async function requireUser(opts: { allowPasswordChange?: boolean } = {}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword && !opts.allowPasswordChange) redirect("/change-password");
  return user;
}

export class PermissionError extends Error {
  constructor() {
    super("forbidden");
  }
}

/** For pages: redirect to the dashboard when the role lacks the permission. */
export async function requirePage(module: ModuleKey, action: ActionKey = "view") {
  const user = await requireUser();
  if (!can(user.role, module, action)) redirect("/dashboard?denied=1");
  return user;
}

/** For server actions and route handlers: throws so nothing is written without the right. */
export async function requirePermission(module: ModuleKey, action: ActionKey) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword || !can(user.role, module, action)) throw new PermissionError();
  return user;
}

/** Signed in with at least one of the given rights. */
export async function requireAny(pairs: [ModuleKey, ActionKey][]) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword || !pairs.some(([m, a]) => can(user.role, m, a))) throw new PermissionError();
  return user;
}

export async function requireSuperAdmin() {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword || !canReadAudit(user.role)) throw new PermissionError();
  return user;
}

export function actorOf(user: CurrentUser) {
  return { id: user.id, fullName: user.fullName };
}

export { describeDevice };

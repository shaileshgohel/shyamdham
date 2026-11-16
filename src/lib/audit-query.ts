import "server-only";
import type { Prisma } from "@prisma/client";
import { istDayStart } from "./format";

export type AuditFilters = { user?: number; entity?: string; action?: string; from?: string; to?: string; q?: string };

export function parseAuditFilters(sp: Record<string, string | string[] | undefined>): AuditFilters {
  const g = (k: string) => { const v = sp[k]; const s = (Array.isArray(v) ? v[0] : v)?.trim(); return s ? s.slice(0, 60) : undefined; };
  const ymd = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined);
  return { user: Number(g("user")) || undefined, entity: g("entity"), action: g("action"), from: ymd(g("from")), to: ymd(g("to")), q: g("q") };
}

export function auditWhere(f: AuditFilters): Prisma.AuditLogWhereInput {
  const at: Prisma.DateTimeFilter = {};
  if (f.from) at.gte = istDayStart(f.from);
  if (f.to) at.lt = new Date(istDayStart(f.to).getTime() + 86_400_000);
  return {
    ...(f.user ? { userId: f.user } : {}),
    ...(f.entity ? { entity: f.entity } : {}),
    ...(f.action ? { action: f.action } : {}),
    ...(f.from || f.to ? { at } : {}),
    ...(f.q ? { OR: [{ docNo: { contains: f.q, mode: "insensitive" } }, { summary: { contains: f.q, mode: "insensitive" } }] } : {}),
  };
}

export const AUDIT_ACTIONS = ["login", "login_failed", "logout", "create", "edit", "cancel", "restore", "import", "export", "password_change", "password_reset"];
export const AUDIT_ENTITIES = ["family", "member", "user", "role", "master_value", "session"];

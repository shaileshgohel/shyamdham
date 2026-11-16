import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";
import { db, type Tx } from "./db";

export type Actor = { id: number; fullName: string } | null;

type AuditInput = {
  action: string;
  entity: string;
  entityId?: string | number | null;
  docNo?: string | null;
  summary: string;
  changes?: Record<string, [unknown, unknown]> | null;
};

export async function requestMeta() {
  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim() || null;
  return { ip, device: describeDevice(h.get("user-agent")) };
}

/** Short human label for the audit log's device column. */
export function describeDevice(ua: string | null | undefined): string | null {
  if (!ua) return null;
  const mobile = /Android|iPhone|iPad|Mobile/i.test(ua);
  const os = /Android/i.test(ua)
    ? "Android"
    : /iPhone|iPad/i.test(ua)
      ? "iOS"
      : /Windows/i.test(ua)
        ? "Windows"
        : /Mac OS X/i.test(ua)
          ? "Mac"
          : /Linux/i.test(ua)
            ? "Linux"
            : "";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Safari\//.test(ua)
          ? "Safari"
          : "";
  return [mobile ? "મોબાઈલ" : "PC", os, browser].filter(Boolean).join(" · ");
}

/** Write one audit entry. Pass the transaction so the entry commits or rolls back with the change it describes. */
export async function audit(actor: Actor, input: AuditInput, tx: Tx = db) {
  const meta = await requestMeta();
  await tx.auditLog.create({
    data: {
      userId: actor?.id ?? null,
      userName: actor?.fullName ?? "—",
      action: input.action,
      entity: input.entity,
      entityId: input.entityId == null ? null : String(input.entityId),
      docNo: input.docNo ?? null,
      summary: input.summary,
      changes: (input.changes ?? undefined) as Prisma.InputJsonValue | undefined,
      ip: meta.ip,
      device: meta.device,
    },
  });
}

/** Field-by-field difference for edit entries: { field: [old, new] }. */
export function diff<T extends Record<string, unknown>>(before: T, after: Partial<T>, fields: (keyof T)[]) {
  const out: Record<string, [unknown, unknown]> = {};
  for (const f of fields) {
    const a = normalize(before[f]);
    const b = normalize(after[f]);
    if (a !== b) out[f as string] = [a, b];
  }
  return out;
}

function normalize(v: unknown) {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (v === undefined || v === "") return null;
  return v as string | number | boolean | null;
}

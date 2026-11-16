import "server-only";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { normalizeMobile } from "./format";
import type { DictKey } from "./i18n-dict";

const opt = (max = 120) =>
  z
    .string()
    .max(max)
    .transform((s) => s.trim())
    .optional()
    .nullable()
    .transform((s) => (s ? s : null));

export const memberInput = z.object({
  id: z.number().int().positive().optional().nullable(),
  firstName: z.string().trim().min(1).max(60),
  fatherName: opt(60),
  surname: z.string().trim().min(1).max(60),
  relation: z.string().trim().min(1).max(30),
  gender: z.enum(["M", "F"]).optional().nullable().or(z.literal("").transform(() => null)),
  dob: opt(10),
  mobile: opt(20),
  email: opt(120),
  bloodGroup: opt(4),
  education: opt(60),
  occupation: opt(60),
  maritalStatus: opt(20),
  pan: opt(12),
  isAlive: z.boolean().default(true),
});

export const familyInput = z.object({
  id: z.number().int().positive().optional().nullable(),
  address: opt(400),
  area: opt(60),
  vatan: opt(60),
  city: opt(60),
  membershipType: z.string().trim().max(20).default("સામાન્ય"),
  notes: opt(500),
  headIndex: z.number().int().min(0).default(0),
  members: z.array(memberInput).min(1).max(40),
});

export type FamilyInput = z.infer<typeof familyInput>;
export type MemberInput = z.infer<typeof memberInput>;
export type FieldErrors = Record<string, DictKey>;

export type CleanMember = Omit<MemberInput, "dob" | "mobile" | "pan" | "email"> & {
  dob: Date | null;
  mobile: string | null;
  pan: string | null;
  email: string | null;
};

/** Field-level checks beyond the schema. Returns cleaned members and errors keyed "members.<i>.<field>". */
export function cleanMembers(members: MemberInput[]): { clean: CleanMember[]; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const clean = members.map((m, i) => {
    const mob = normalizeMobile(m.mobile);
    if (mob === "invalid") errors[`members.${i}.mobile`] = "err_mobile";
    let dob: Date | null = null;
    if (m.dob) {
      const d = new Date(`${m.dob}T00:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(m.dob) || isNaN(d.getTime()) || d > new Date() || d.getUTCFullYear() < 1900) {
        errors[`members.${i}.dob`] = "err_dob";
      } else dob = d;
    }
    const pan = m.pan ? m.pan.toUpperCase().replace(/\s/g, "") : null;
    if (pan && !/^[A-Z]{5}\d{4}[A-Z]$/.test(pan)) errors[`members.${i}.pan`] = "err_pan";
    const email = m.email ? m.email.toLowerCase() : null;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors[`members.${i}.email`] = "err_email";
    return { ...m, dob, mobile: mob === "invalid" ? null : mob, pan, email };
  });
  return { clean, errors };
}

/** Is this mobile already the head mobile of another family? */
export async function headMobileOwner(mobile: string, exceptFamilyId?: number | null) {
  return db.member.findFirst({
    where: { isHead: true, mobile, ...(exceptFamilyId ? { familyId: { not: exceptFamilyId } } : {}) },
    include: { family: { select: { familyNo: true } } },
  });
}

// ---------- directory search ----------

export type DirectoryFilters = {
  q?: string;
  vatan?: string;
  area?: string;
  occupation?: string;
  bloodGroup?: string;
  inactive?: boolean;
};

export function parseFilters(sp: Record<string, string | string[] | undefined>): DirectoryFilters {
  const g = (k: string) => {
    const v = sp[k];
    const s = (Array.isArray(v) ? v[0] : v)?.trim();
    return s ? s.slice(0, 80) : undefined;
  };
  return { q: g("q"), vatan: g("vatan"), area: g("area"), occupation: g("occupation"), bloodGroup: g("blood"), inactive: g("inactive") === "1" };
}

function memberMatch(f: DirectoryFilters): Prisma.MemberWhereInput[] {
  const and: Prisma.MemberWhereInput[] = [];
  if (f.occupation) and.push({ occupation: f.occupation });
  if (f.bloodGroup) and.push({ bloodGroup: f.bloodGroup });
  if (f.q) {
    const words = f.q.split(/\s+/).filter(Boolean).slice(0, 4);
    for (const w of words) {
      const digits = w.replace(/\D/g, "");
      and.push({
        OR: [
          { firstName: { contains: w, mode: "insensitive" } },
          { fatherName: { contains: w, mode: "insensitive" } },
          { surname: { contains: w, mode: "insensitive" } },
          ...(digits.length >= 4 ? [{ mobile: { contains: digits } }] : []),
          { family: { familyNo: { contains: w, mode: "insensitive" } } },
        ],
      });
    }
  }
  return and;
}

function familyMatch(f: DirectoryFilters): Prisma.FamilyWhereInput {
  return {
    ...(f.inactive ? {} : { isActive: true }),
    ...(f.vatan ? { vatan: f.vatan } : {}),
    ...(f.area ? { area: f.area } : {}),
  };
}

/** Families where at least one member matches the person-level filters. */
export function familyWhere(f: DirectoryFilters): Prisma.FamilyWhereInput {
  const m = memberMatch(f);
  return { ...familyMatch(f), ...(m.length ? { members: { some: { AND: m } } } : {}) };
}

/** Individual people matching all filters. */
export function memberWhere(f: DirectoryFilters): Prisma.MemberWhereInput {
  return { AND: [{ family: familyMatch(f) }, ...memberMatch(f)] };
}

export async function masterLists() {
  const rows = await db.masterValue.findMany({ orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { value: "asc" }] });
  const out: Record<string, string[]> = { VATAN: [], AREA: [], OCCUPATION: [], EDUCATION: [] };
  for (const r of rows) (out[r.type] ??= []).push(r.value);
  return out;
}

export const MEMBER_AUDIT_FIELDS = [
  "firstName", "fatherName", "surname", "relation", "gender", "dob", "mobile", "email",
  "bloodGroup", "education", "occupation", "maritalStatus", "pan", "isAlive", "isHead",
] as const;
export const FAMILY_AUDIT_FIELDS = ["address", "area", "vatan", "city", "membershipType", "notes"] as const;

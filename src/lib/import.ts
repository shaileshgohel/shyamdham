import "server-only";
import { db } from "./db";
import { cleanMembers, familyInput, type FamilyInput } from "./members";
import { translate, type DictKey, type Lang } from "./i18n-dict";
import type { SheetRow } from "./excel";

export type ImportProblem = { rowNo: number; message: string };
export type ImportPlan = { families: FamilyInput[]; rowsOf: number[][]; problems: ImportProblem[]; memberCount: number };

function toIsoDate(s?: string): string | null | "bad" {
  if (!s) return null;
  const t = s.trim();
  let m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return "bad";
}

function toGender(s?: string): "M" | "F" | null {
  if (!s) return null;
  const g = s.trim().toLowerCase();
  if (["m", "male", "પુ", "પુરુષ", "પુ."].includes(g)) return "M";
  if (["f", "female", "સ્ત્રી", "સ્ત્રી."].includes(g)) return "F";
  return null;
}

const HEAD_WORDS = ["સ્વયં", "self", "head", "મુખ્ય"];

/** Turn spreadsheet rows into validated families. Nothing is written here. */
export async function planImport(rows: SheetRow[], lang: Lang): Promise<ImportPlan> {
  const t = (k: DictKey, v?: Record<string, string | number>) => translate(lang, k, v);
  const L = (gu: string, en: string) => (lang === "en" ? en : gu);
  const problems: ImportProblem[] = [];
  const groups = new Map<string, SheetRow[]>();
  for (const r of rows) {
    const code = r.values.familyCode?.trim();
    if (!code) {
      problems.push({ rowNo: r.rowNo, message: L("'પરિવાર કોડ' ખાલી છે.", "'Family code' is empty.") });
      continue;
    }
    if (!groups.has(code)) groups.set(code, []);
    groups.get(code)!.push(r);
  }

  const families: FamilyInput[] = [];
  const rowsOf: number[][] = [];
  const seenHeadMobiles = new Map<string, number>();

  for (const [code, grp] of groups) {
    const heads = grp.filter((r) => HEAD_WORDS.includes((r.values.relation ?? "").trim().toLowerCase()));
    if (heads.length !== 1) {
      problems.push({
        rowNo: grp[0].rowNo,
        message: L(`પરિવાર કોડ ${code}: બરાબર એક 'સ્વયં' જોઈએ (મળ્યા ${heads.length}).`, `Family code ${code}: needs exactly one 'સ્વયં' (found ${heads.length}).`),
      });
      continue;
    }
    const head = heads[0];
    const ordered = [head, ...grp.filter((r) => r !== head)];
    let bad = false;
    const members = ordered.map((r) => {
      const v = r.values;
      if (!v.firstName || !v.surname) {
        problems.push({ rowNo: r.rowNo, message: L("નામ અને અટક ફરજિયાત છે.", "First name and surname are required.") });
        bad = true;
      }
      const dob = toIsoDate(v.dob);
      if (dob === "bad") {
        problems.push({ rowNo: r.rowNo, message: `${t("err_dob")} (${v.dob})` });
        bad = true;
      }
      return {
        firstName: v.firstName ?? "",
        fatherName: v.fatherName ?? null,
        surname: v.surname ?? "",
        relation: r === head ? "સ્વયં" : (v.relation ?? "અન્ય"),
        gender: toGender(v.gender),
        dob: dob === "bad" ? null : dob,
        mobile: v.mobile ?? null,
        email: v.email ?? null,
        bloodGroup: v.bloodGroup?.toUpperCase().replace(/\s/g, "") ?? null,
        education: v.education ?? null,
        occupation: v.occupation ?? null,
        maritalStatus: v.maritalStatus ?? null,
        pan: null,
        isAlive: true,
      };
    });
    if (bad) continue;

    const parsed = familyInput.safeParse({
      address: head.values.address ?? null,
      area: head.values.area ?? null,
      vatan: head.values.vatan ?? null,
      city: "જુનાગઢ",
      membershipType: head.values.membershipType ?? "સામાન્ય",
      notes: null,
      headIndex: 0,
      members,
    });
    if (!parsed.success) {
      problems.push({ rowNo: head.rowNo, message: L(`પરિવાર કોડ ${code}: વિગત અધૂરી છે.`, `Family code ${code}: details are incomplete.`) });
      continue;
    }
    const { clean, errors } = cleanMembers(parsed.data.members);
    if (Object.keys(errors).length) {
      for (const [path, key] of Object.entries(errors)) {
        const idx = Number(path.split(".")[1]);
        problems.push({ rowNo: ordered[idx].rowNo, message: t(key) });
      }
      continue;
    }
    const headMobile = clean[0].mobile;
    if (headMobile) {
      if (seenHeadMobiles.has(headMobile)) {
        problems.push({ rowNo: head.rowNo, message: L(`આ મોબાઈલ લાઇન ${seenHeadMobiles.get(headMobile)} માં પણ મુખ્ય સભ્યનો છે.`, `This mobile is also a head mobile on row ${seenHeadMobiles.get(headMobile)}.`) });
        continue;
      }
      seenHeadMobiles.set(headMobile, head.rowNo);
    }
    families.push(parsed.data);
    rowsOf.push(ordered.map((r) => r.rowNo));
  }

  // Head mobiles that already exist in the portal.
  const mobiles = [...seenHeadMobiles.keys()];
  if (mobiles.length) {
    const existing = await db.member.findMany({ where: { isHead: true, mobile: { in: mobiles } }, include: { family: { select: { familyNo: true } } } });
    for (const e of existing) {
      const rowNo = seenHeadMobiles.get(e.mobile!)!;
      problems.push({ rowNo, message: t("err_dup_mobile", { no: e.family.familyNo, name: `${e.firstName} ${e.surname}` }) });
      const idx = rowsOf.findIndex((r) => r[0] === rowNo);
      if (idx >= 0) { families.splice(idx, 1); rowsOf.splice(idx, 1); }
    }
  }

  problems.sort((a, b) => a.rowNo - b.rowNo);
  return { families, rowsOf, problems, memberCount: families.reduce((n, f) => n + f.members.length, 0) };
}

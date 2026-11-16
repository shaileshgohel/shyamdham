import "server-only";
import ExcelJS from "exceljs";

// Columns for both the import template and the member export. One row per person.
export const MEMBER_COLUMNS = [
  { key: "familyCode", gu: "પરિવાર કોડ", en: "Family code", width: 12 },
  { key: "relation", gu: "સંબંધ", en: "Relation", width: 10 },
  { key: "firstName", gu: "નામ", en: "First name", width: 14 },
  { key: "fatherName", gu: "પિતા/પતિનું નામ", en: "Father/husband", width: 16 },
  { key: "surname", gu: "અટક", en: "Surname", width: 12 },
  { key: "gender", gu: "જાતિ (પુ/સ્ત્રી)", en: "Gender (M/F)", width: 10 },
  { key: "dob", gu: "જન્મ તારીખ (dd/mm/yyyy)", en: "Date of birth", width: 14 },
  { key: "mobile", gu: "મોબાઈલ", en: "Mobile", width: 13 },
  { key: "bloodGroup", gu: "બ્લડ ગ્રુપ", en: "Blood group", width: 8 },
  { key: "education", gu: "અભ્યાસ", en: "Education", width: 12 },
  { key: "occupation", gu: "વ્યવસાય", en: "Occupation", width: 14 },
  { key: "maritalStatus", gu: "વૈવાહિક સ્થિતિ", en: "Marital status", width: 12 },
  { key: "email", gu: "ઈમેલ", en: "Email", width: 20 },
  { key: "vatan", gu: "મૂળ વતન", en: "Native village", width: 12 },
  { key: "area", gu: "વિસ્તાર", en: "Area", width: 14 },
  { key: "address", gu: "સરનામું", en: "Address", width: 30 },
  { key: "membershipType", gu: "સભ્યપદ", en: "Membership", width: 10 },
] as const;

export type MemberColumnKey = (typeof MEMBER_COLUMNS)[number]["key"];
export type SheetRow = { rowNo: number; values: Partial<Record<MemberColumnKey, string>> };

const header = (c: (typeof MEMBER_COLUMNS)[number]) => `${c.gu} (${c.en})`;

function normHeader(s: string) {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function columnFor(headerText: string): MemberColumnKey | null {
  const h = normHeader(headerText);
  if (!h) return null;
  for (const c of MEMBER_COLUMNS) {
    if (h === normHeader(header(c)) || h === normHeader(c.gu) || h === normHeader(c.en) || h === c.key.toLowerCase()) return c.key;
  }
  for (const c of MEMBER_COLUMNS) {
    if (h.startsWith(normHeader(c.gu)) || h.includes(`(${normHeader(c.en)})`)) return c.key;
  }
  return null;
}

function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (v instanceof Date) {
    const dd = String(v.getUTCDate()).padStart(2, "0");
    const mm = String(v.getUTCMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}/${v.getUTCFullYear()}`;
  }
  if (typeof v === "object") {
    if ("text" in v && typeof v.text === "string") return v.text;
    if ("result" in v) return cellText(v.result as ExcelJS.CellValue);
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    return "";
  }
  return String(v).trim();
}

export async function readMemberSheet(buf: ArrayBuffer, filename: string): Promise<SheetRow[]> {
  let grid: string[][];
  if (/\.csv$/i.test(filename)) {
    grid = parseCsv(new TextDecoder("utf-8").decode(buf).replace(/^﻿/, ""));
  } else {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const ws = wb.worksheets[0];
    if (!ws) return [];
    grid = [];
    ws.eachRow({ includeEmpty: true }, (row, n) => {
      const cells: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell, col) => (cells[col - 1] = cellText(cell.value)));
      grid[n - 1] = cells;
    });
  }
  const headerRow = grid.findIndex((r) => r && r.some((c) => columnFor(c ?? "")));
  if (headerRow < 0) return [];
  const map = (grid[headerRow] ?? []).map((h) => columnFor(h ?? ""));
  const out: SheetRow[] = [];
  for (let i = headerRow + 1; i < grid.length; i++) {
    const r = grid[i];
    if (!r || r.every((c) => !c?.trim())) continue;
    const values: SheetRow["values"] = {};
    map.forEach((k, j) => {
      if (k && r[j]?.trim()) values[k] = r[j].trim();
    });
    out.push({ rowNo: i + 1, values });
  }
  return out;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cur); rows.push(row); row = []; cur = "";
    } else cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

function styleHeader(ws: ExcelJS.Worksheet) {
  const r = ws.getRow(1);
  r.font = { bold: true };
  r.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE4EAFA" } };
  r.alignment = { vertical: "middle", wrapText: true };
  r.height = 32;
  ws.views = [{ state: "frozen", ySplit: 1 }];
}

export async function templateWorkbook(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("સભ્યો");
  ws.columns = MEMBER_COLUMNS.map((c) => ({ header: header(c), key: c.key, width: c.width + 6 }));
  styleHeader(ws);
  ws.addRow({ familyCode: "1", relation: "સ્વયં", firstName: "રમેશભાઈ", fatherName: "મોહનભાઈ", surname: "પરમાર", gender: "પુ", dob: "12/03/1971", mobile: "9000000010", bloodGroup: "B+", education: "ધો. 12", occupation: "કોન્ટ્રાક્ટર", maritalStatus: "પરિણીત", vatan: "વંથલી", area: "મધુરમ", address: "નમૂનો સરનામું, જુનાગઢ", membershipType: "આજીવન" });
  ws.addRow({ familyCode: "1", relation: "પત્ની", firstName: "ગીતાબેન", fatherName: "રમેશભાઈ", surname: "પરમાર", gender: "સ્ત્રી", dob: "05/08/1974", maritalStatus: "પરિણીત" });
  ws.addRow({ familyCode: "2", relation: "સ્વયં", firstName: "જયેશભાઈ", fatherName: "કાનજીભાઈ", surname: "ચૌહાણ", gender: "પુ", mobile: "9000000045", vatan: "કેશોદ", area: "ઝાંઝરડા રોડ" });
  const notes = wb.addWorksheet("સૂચના");
  notes.columns = [{ width: 110 }];
  [
    "સૂચના (Instructions)",
    "• પહેલી શીટમાં એક વ્યક્તિ માટે એક લાઇન લખો. ઉપરની 3 નમૂનાની લાઇન કાઢી નાખો.",
    "• એક પરિવારના બધા સભ્યોને સરખો 'પરિવાર કોડ' આપો (દા.ત. 1, 2, 3 અથવા જૂનો રજિસ્ટર નંબર).",
    "• મુખ્ય સભ્યનો સંબંધ 'સ્વયં' લખો. દરેક પરિવારમાં બરાબર એક 'સ્વયં' હોવો જોઈએ.",
    "• વતન, વિસ્તાર, સરનામું અને સભ્યપદ મુખ્ય સભ્યની લાઇનમાંથી લેવાશે.",
    "• મોબાઈલ 10 આંકડાનો. જન્મ તારીખ dd/mm/yyyy. જાતિ: પુ / સ્ત્રી (અથવા M / F).",
    "• નામ અને અટક ફરજિયાત છે. બાકીના ખાના ખાલી રાખી શકાય.",
    "• સભ્ય નંબર (M-00001) પોર્ટલ આપોઆપ આપશે.",
  ].forEach((l, i) => {
    const r = notes.addRow([l]);
    if (i === 0) r.font = { bold: true, size: 13 };
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function membersWorkbook(rows: Record<string, string | number | null>[], extra: { title: string }): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Shyamdham portal";
  const ws = wb.addWorksheet(extra.title.slice(0, 30));
  ws.columns = [
    { header: "સભ્ય નં. (Member no.)", key: "familyNo", width: 14 },
    { header: "મુખ્ય (Head)", key: "isHead", width: 8 },
    ...MEMBER_COLUMNS.filter((c) => c.key !== "familyCode").map((c) => ({ header: header(c), key: c.key, width: c.width + 4 })),
    { header: "હયાત (Living)", key: "isAlive", width: 8 },
  ];
  styleHeader(ws);
  for (const r of rows) ws.addRow(r);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

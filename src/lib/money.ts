import type { Prisma } from "@prisma/client";

type Dec = Prisma.Decimal | number | string | null | undefined;

export function num(v: Dec): number {
  if (v == null) return 0;
  return typeof v === "number" ? v : Number(v.toString());
}

/** ₹ 1,23,456 (paise shown only when present). */
export function inr(v: Dec, opts: { symbol?: boolean } = {}) {
  const n = num(v);
  const hasPaise = Math.round(n * 100) % 100 !== 0;
  const s = n.toLocaleString("en-IN", { minimumFractionDigits: hasPaise ? 2 : 0, maximumFractionDigits: 2 });
  return opts.symbol === false ? s : `₹ ${s}`;
}

/** Parse a rupee amount typed by a person: "5,100", "5100.50". Returns null when invalid. */
export function parseAmount(raw: unknown): number | null {
  const s = String(raw ?? "").replace(/[,\s₹]/g, "");
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(s)) return null;
  const n = Number(s);
  return n > 0 ? n : null;
}

// ---------- financial year (April–March) ----------

/** "26-27" for any date from 1 Apr 2026 to 31 Mar 2027. */
export function fyOf(d: Date) {
  const y = d.getUTCFullYear();
  const start = d.getUTCMonth() >= 3 ? y : y - 1;
  return `${String(start % 100).padStart(2, "0")}-${String((start + 1) % 100).padStart(2, "0")}`;
}

/** First and last day (yyyy-mm-dd) of the financial year that contains ymd. */
export function fyRange(ymd: string) {
  const [y, m] = ymd.split("-").map(Number);
  const start = m >= 4 ? y : y - 1;
  return { from: `${start}-04-01`, to: `${start + 1}-03-31`, label: `${start}-${String((start + 1) % 100).padStart(2, "0")}`, startYear: start };
}

/** Calendar date stored in a @db.Date column. */
export function dateOnly(ymd: string) {
  return new Date(`${ymd}T00:00:00Z`);
}

export function ymdOf(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function isYmd(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(`${s}T00:00:00Z`).getTime());
}

export function addDays(ymd: string, n: number) {
  const d = dateOnly(ymd);
  d.setUTCDate(d.getUTCDate() + n);
  return ymdOf(d);
}

export function daysBetween(fromYmd: string, toYmd: string) {
  return Math.round((dateOnly(toYmd).getTime() - dateOnly(fromYmd).getTime()) / 86_400_000) + 1;
}

export const MONTHS_GU = ["જાન્યુઆરી", "ફેબ્રુઆરી", "માર્ચ", "એપ્રિલ", "મે", "જૂન", "જુલાઈ", "ઓગસ્ટ", "સપ્ટેમ્બર", "ઓક્ટોબર", "નવેમ્બર", "ડિસેમ્બર"];
export const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// ---------- amount in words ----------

// Gujarati number names 0–99 are irregular, so they are listed in full.
const GU_0_99 = [
  "શૂન્ય", "એક", "બે", "ત્રણ", "ચાર", "પાંચ", "છ", "સાત", "આઠ", "નવ",
  "દસ", "અગિયાર", "બાર", "તેર", "ચૌદ", "પંદર", "સોળ", "સત્તર", "અઢાર", "ઓગણીસ",
  "વીસ", "એકવીસ", "બાવીસ", "ત્રેવીસ", "ચોવીસ", "પચ્ચીસ", "છવ્વીસ", "સત્તાવીસ", "અઠ્ઠાવીસ", "ઓગણત્રીસ",
  "ત્રીસ", "એકત્રીસ", "બત્રીસ", "તેત્રીસ", "ચોત્રીસ", "પાંત્રીસ", "છત્રીસ", "સાડત્રીસ", "આડત્રીસ", "ઓગણચાલીસ",
  "ચાલીસ", "એકતાલીસ", "બેતાલીસ", "ત્રેતાલીસ", "ચુંમાલીસ", "પિસ્તાલીસ", "છેતાલીસ", "સુડતાલીસ", "અડતાલીસ", "ઓગણપચાસ",
  "પચાસ", "એકાવન", "બાવન", "ત્રેપન", "ચોપન", "પંચાવન", "છપ્પન", "સત્તાવન", "અઠ્ઠાવન", "ઓગણસાઠ",
  "સાઠ", "એકસઠ", "બાસઠ", "ત્રેસઠ", "ચોસઠ", "પાંસઠ", "છાસઠ", "સડસઠ", "અડસઠ", "ઓગણસિત્તેર",
  "સિત્તેર", "એકોતેર", "બોતેર", "તોતેર", "ચુમોતેર", "પંચોતેર", "છોતેર", "સિત્યોતેર", "ઇઠ્યોતેર", "ઓગણએંસી",
  "એંસી", "એક્યાસી", "બ્યાસી", "ત્યાસી", "ચોર્યાસી", "પંચાસી", "છ્યાસી", "સિત્યાસી", "ઈઠ્યાસી", "નેવ્યાસી",
  "નેવું", "એકાણું", "બાણું", "ત્રાણું", "ચોરાણું", "પંચાણું", "છન્નું", "સત્તાણું", "અઠ્ઠાણું", "નવ્વાણું",
];
const GU_HUNDREDS = ["", "એકસો", "બસો", "ત્રણસો", "ચારસો", "પાંચસો", "છસો", "સાતસો", "આઠસો", "નવસો"];

function guBelow1000(n: number) {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return [h ? GU_HUNDREDS[h] : "", r ? GU_0_99[r] : ""].filter(Boolean).join(" ");
}

/** Indian system: કરોડ, લાખ, હજાર. 5100 → "પાંચ હજાર એકસો". */
export function rupeesInGujarati(amount: number) {
  let n = Math.floor(amount);
  if (n === 0) return GU_0_99[0];
  const crore = Math.floor(n / 1e7); n %= 1e7;
  const lakh = Math.floor(n / 1e5); n %= 1e5;
  const thousand = Math.floor(n / 1e3); n %= 1e3;
  const parts: string[] = [];
  if (crore) parts.push(`${crore < 100 ? GU_0_99[crore] : rupeesInGujarati(crore)} કરોડ`);
  if (lakh) parts.push(`${GU_0_99[lakh]} લાખ`);
  if (thousand) parts.push(`${GU_0_99[thousand]} હજાર`);
  if (n) parts.push(guBelow1000(n));
  const paise = Math.round((amount - Math.floor(amount)) * 100);
  return parts.join(" ") + (paise ? ` અને ${GU_0_99[paise]} પૈસા` : "");
}

const EN_0_19 = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const EN_TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
function en99(n: number) {
  return n < 20 ? EN_0_19[n] : EN_TENS[Math.floor(n / 10)] + (n % 10 ? `-${EN_0_19[n % 10]}` : "");
}
function en999(n: number) {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return [h ? `${EN_0_19[h]} hundred` : "", r ? en99(r) : ""].filter(Boolean).join(" ");
}
export function rupeesInEnglish(amount: number) {
  let n = Math.floor(amount);
  if (n === 0) return "zero";
  const crore = Math.floor(n / 1e7); n %= 1e7;
  const lakh = Math.floor(n / 1e5); n %= 1e5;
  const thousand = Math.floor(n / 1e3); n %= 1e3;
  const parts: string[] = [];
  if (crore) parts.push(`${crore < 1000 ? en999(crore) : rupeesInEnglish(crore)} crore`);
  if (lakh) parts.push(`${en99(lakh)} lakh`);
  if (thousand) parts.push(`${en99(thousand)} thousand`);
  if (n) parts.push(en999(n));
  const s = parts.join(" ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const PAY_MODES = ["CASH", "UPI", "CHEQUE", "BANK"] as const;
export type PayMode = (typeof PAY_MODES)[number];
export const PAY_MODE_GU: Record<string, string> = { CASH: "રોકડ", UPI: "UPI", CHEQUE: "ચેક", BANK: "બેંક ટ્રાન્સફર", ADJUST: "ડિપોઝિટમાંથી સરભર" };
export const PAY_MODE_EN: Record<string, string> = { CASH: "Cash", UPI: "UPI", CHEQUE: "Cheque", BANK: "Bank transfer", ADJUST: "Adjusted from deposit" };

/** Like parseAmount, but an empty field or 0 means zero. Returns null only when invalid. */
export function parseAmountOrZero(raw: unknown): number | null {
  const s = String(raw ?? "").replace(/[,\s₹]/g, "");
  if (s === "" || /^0+(\.0{1,2})?$/.test(s)) return 0;
  return parseAmount(s);
}

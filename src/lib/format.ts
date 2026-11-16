// Display helpers. Dates are shown dd/mm/yyyy, times in India Standard Time.

const TZ = "Asia/Kolkata";

export function fmtDate(d: Date | null | undefined) {
  if (!d) return "";
  // DOB is stored as a calendar date (UTC midnight), so format it in UTC to avoid shifting a day.
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

export function fmtDateTime(d: Date | null | undefined) {
  if (!d) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .format(d)
    .replace(",", "");
}

/** yyyy-mm-dd of "now" in India, for date inputs and day boundaries. */
export function todayIST() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

/** Start of a yyyy-mm-dd day in IST as a UTC Date. */
export function istDayStart(ymd: string) {
  return new Date(`${ymd}T00:00:00+05:30`);
}

export function isoDate(d: Date | null | undefined) {
  return d ? d.toISOString().slice(0, 10) : "";
}

/** Keep the last 10 digits of an Indian mobile number; returns null when it is not one. */
export function normalizeMobile(raw: string | null | undefined): string | null | "invalid" {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  const ten = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits.length === 11 && digits.startsWith("0") ? digits.slice(1) : digits;
  return /^[6-9]\d{9}$/.test(ten) ? ten : "invalid";
}

export function fmtMobile(m: string | null | undefined) {
  if (!m) return "";
  return m.length === 10 ? `${m.slice(0, 5)} ${m.slice(5)}` : m;
}

export function fullName(m: { firstName: string; fatherName?: string | null; surname: string }) {
  return [m.firstName, m.fatherName, m.surname].filter(Boolean).join(" ");
}

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
export const RELATIONS = ["સ્વયં", "પત્ની", "પતિ", "પુત્ર", "પુત્રી", "પુત્રવધૂ", "પૌત્ર", "પૌત્રી", "પિતા", "માતા", "ભાઈ", "બહેન", "ભાભી", "ભત્રીજો", "ભત્રીજી", "અન્ય"];
export const MARITAL = ["અપરિણીત", "પરિણીત", "વિધુર", "વિધવા", "છૂટાછેડા"];
export const MEMBERSHIP = ["સામાન્ય", "આજીવન"];
export const MASTER_TYPES = ["VATAN", "AREA", "OCCUPATION", "EDUCATION"] as const;
export type MasterType = (typeof MASTER_TYPES)[number];

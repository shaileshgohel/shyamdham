import "server-only";
import { db } from "./db";
import { accountFitsMode } from "./accounts";
import { isYmd, parseAmount, PAY_MODES } from "./money";
import { todayIST } from "./format";

export const str = (fd: FormData, k: string, max = 200) => {
  const v = String(fd.get(k) ?? "").trim().slice(0, max);
  return v || null;
};

/** Reads mode / account / reference / amount from a form and checks they fit together. */
export async function moneyFromForm(fd: FormData, prefix = "") {
  const mode = String(fd.get(`${prefix}mode`) ?? "CASH");
  if (!(PAY_MODES as readonly string[]).includes(mode)) return { error: "mode" as const };
  const accountId = Number(fd.get(`${prefix}accountId`));
  const account = accountId ? await db.moneyAccount.findUnique({ where: { id: accountId } }) : null;
  if (!account || !account.isActive || !accountFitsMode(account.kind, mode)) return { error: "account" as const };
  const amount = parseAmount(fd.get(`${prefix}amount`));
  if (amount == null) return { error: "amount" as const };
  return { mode, account, amount, reference: str(fd, `${prefix}reference`, 60) };
}

/** A date from the form; only people allowed to backdate may pick a day other than today, never a future day. */
export function dateFromForm(fd: FormData, key: string, mayBackdate: boolean): string | null {
  const today = todayIST();
  const v = String(fd.get(key) ?? "");
  if (!v || !mayBackdate) return today;
  if (!isYmd(v) || v > today) return null;
  return v;
}

export const MONEY_ERRORS = {
  mode: ["પેમેન્ટનો પ્રકાર ખોટો છે.", "Payment mode is not valid."],
  account: ["પેમેન્ટના પ્રકાર પ્રમાણે સાચું ખાતું પસંદ કરો (રોકડ માટે રોકડ ખાતું, બાકી માટે બેંક ખાતું).", "Choose an account that fits the payment mode (cash account for cash, bank account otherwise)."],
  amount: ["રકમ ખોટી છે. ફક્ત આંકડા લખો, દા.ત. 5100.", "The amount is not valid. Use digits only, e.g. 5100."],
} as const;

export function moneyError(t: { g: (gu: string, en: string) => string }, k: keyof typeof MONEY_ERRORS) {
  return t.g(MONEY_ERRORS[k][0], MONEY_ERRORS[k][1]);
}

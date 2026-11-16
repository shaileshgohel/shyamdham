import "server-only";
import { db } from "./db";

// Trust details printed on receipts and bills. Edited by the Super Admin under Settings.
export const SETTING_FIELDS = [
  { key: "trust_name", gu: "સંસ્થાનું નામ", en: "Trust name", default: "શ્યામધામ મધુરમ" },
  { key: "trust_sub", gu: "પેટા નામ", en: "Sub-title", default: "શ્રી કડિયા જ્ઞાતિ, જુનાગઢ" },
  { key: "address", gu: "સરનામું", en: "Address", default: "મધુરમ, જુનાગઢ" },
  { key: "phone", gu: "ફોન", en: "Phone", default: "" },
  { key: "reg_no", gu: "ટ્રસ્ટ રજિસ્ટ્રેશન નં.", en: "Trust registration no.", default: "" },
  { key: "pan", gu: "ટ્રસ્ટનો PAN", en: "Trust PAN", default: "" },
  { key: "g80_text", gu: "80G વિગત (રસીદ પર છપાશે)", en: "80G details (printed on receipts)", default: "" },
  { key: "receipt_footer", gu: "રસીદ નીચેનું લખાણ", en: "Receipt footer", default: "આપના ઉદાર દાન બદલ સંસ્થા આપની આભારી છે." },
  { key: "bill_terms", gu: "બિલની શરતો", en: "Bill terms", default: "ડિપોઝિટ પ્રસંગ પછી વસ્તુઓ તપાસીને પરત આપવામાં આવશે. નુકસાન કે ખૂટતી વસ્તુનો ચાર્જ ડિપોઝિટમાંથી કાપવામાં આવશે." },
] as const;

export type SettingKey = (typeof SETTING_FIELDS)[number]["key"];
export type Settings = Record<SettingKey, string>;

export async function getSettings(): Promise<Settings> {
  const rows = await db.setting.findMany();
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return Object.fromEntries(SETTING_FIELDS.map((f) => [f.key, map[f.key] ?? f.default])) as Settings;
}

import "server-only";
import { cookies } from "next/headers";
import { translate, type DictKey, type Lang } from "./i18n-dict";

export const LANG_COOKIE = "sd_lang";

export async function getLang(): Promise<Lang> {
  const jar = await cookies();
  return jar.get(LANG_COOKIE)?.value === "en" ? "en" : "gu";
}

export async function getT() {
  const lang = await getLang();
  const t = (key: DictKey, vars?: Record<string, string | number>) => translate(lang, key, vars);
  /** Inline label for the newer modules: t.g("ગુજરાતી", "English"). */
  const g = (gu: string, en: string) => (lang === "en" ? en : gu);
  return Object.assign(t, { lang, g });
}

export type T = Awaited<ReturnType<typeof getT>>;

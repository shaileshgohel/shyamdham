"use client";
import { createContext, useContext } from "react";
import { translate, type DictKey, type Lang } from "@/lib/i18n-dict";

const LangContext = createContext<Lang>("gu");

export function LangProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

export function useT() {
  const lang = useContext(LangContext);
  return (key: DictKey, vars?: Record<string, string | number>) => translate(lang, key, vars);
}

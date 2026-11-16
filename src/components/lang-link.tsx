"use client";
import { usePathname, useSearchParams } from "next/navigation";

export function LangLink({ label, to }: { label: string; to: "gu" | "en" }) {
  const path = usePathname();
  const qs = useSearchParams().toString();
  const back = encodeURIComponent(path + (qs ? `?${qs}` : ""));
  return <a href={`/lang?to=${to}&back=${back}`}>{label}</a>;
}

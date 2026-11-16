import Link from "next/link";
import type { T } from "@/lib/i18n";

export function AccountsTabs({ t, on }: { t: T; on: string }) {
  const tabs: [string, string, string][] = [
    ["/accounts", "સારાંશ", "Summary"],
    ["/accounts/vouchers", "વાઉચર", "Vouchers"],
    ["/accounts/reports", "રિપોર્ટ", "Reports"],
    ["/accounts/setup", "સેટઅપ", "Setup"],
  ];
  return <nav className="tabs no-print">{tabs.map(([href, gu, en]) => <Link key={href} href={href} className={on === href ? "on" : undefined}>{t.g(gu, en)}</Link>)}</nav>;
}

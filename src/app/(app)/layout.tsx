import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { can, canReadAudit } from "@/lib/permissions";
import { LangProvider } from "@/components/i18n-client";
import { Shell, type NavItem } from "@/components/nav";
import { logoutAction } from "../login/actions";
import { LangLink } from "@/components/lang-link";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const t = await getT();
  const r = user.role;
  const soon = t("nav_soon");

  const items: NavItem[] = [{ href: "/dashboard", label: t("nav_dashboard") }];
  if (can(r, "members", "view")) items.push({ href: "/members", label: t("nav_members") });
  if (can(r, "messages", "view")) items.push({ href: "/messages", label: t("nav_messages"), soon });
  if (can(r, "donations", "view")) items.push({ href: "/donations", label: t("nav_donations") });
  if (can(r, "bookings", "view")) items.push({ href: "/bookings", label: t("nav_bookings") });
  if (can(r, "accounts", "view")) items.push({ href: "/accounts", label: t("nav_accounts") });
  if (can(r, "inventory", "view")) items.push({ href: "/inventory", label: t("nav_inventory") });
  const admin: NavItem[] = [];
  if (can(r, "members", "edit")) admin.push({ href: "/lists", label: t("nav_lists") });
  if (can(r, "users", "view")) admin.push({ href: "/users", label: t("nav_users") });
  if (can(r, "users", "view")) admin.push({ href: "/roles", label: t("nav_roles") });
  if (canReadAudit(r)) admin.push({ href: "/settings", label: t.g("સંસ્થાની વિગત", "Trust details") });
  if (canReadAudit(r)) admin.push({ href: "/audit", label: t("nav_audit") });
  if (admin.length) items.push({ href: "", label: "", group: t.lang === "en" ? "Admin" : "વ્યવસ્થા" }, ...admin);

  const foot = (
    <>
      <div className="who">
        <b>{user.fullName}</b>
        <span className="muted">{t.lang === "en" ? r.nameEn : r.nameGu}</span>
      </div>
      <LangLink label={t("switch_lang")} to={t.lang === "en" ? "gu" : "en"} />
      <Link href="/change-password">{t("change_password")}</Link>
      <form action={logoutAction}><button className="linkbtn">{t("logout")}</button></form>
    </>
  );

  return (
    <LangProvider lang={t.lang}>
      <Shell items={items} foot={foot} title={t("app_name")}>{children}</Shell>
    </LangProvider>
  );
}

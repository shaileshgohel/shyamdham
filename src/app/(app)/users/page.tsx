import Link from "next/link";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { can } from "@/lib/permissions";
import { fmtDateTime, fmtMobile } from "@/lib/format";

export const metadata = { title: "યુઝર્સ" };

export default async function UsersPage() {
  const me = await requirePage("users", "view");
  const t = await getT();
  const users = await db.user.findMany({ include: { role: true }, orderBy: [{ isActive: "desc" }, { fullName: "asc" }] });
  return (
    <>
      <div className="pagehead">
        <div><h1>{t("users_title")}</h1></div>
        {can(me.role, "users", "create") && <Link className="btn pri" href="/users/new">{t("new_user")}</Link>}
      </div>
      <div className="tablewrap">
        <table className="t">
          <thead><tr><th>{t("full_name")}</th><th>{t("username")}</th><th>{t("mobile")}</th><th>{t("role")}</th><th>{t("last_login")}</th><th>{t("status")}</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={u.isActive ? undefined : "dim"}>
                <td><Link href={`/users/${u.id}`}>{u.fullName}</Link></td>
                <td>{u.username}</td>
                <td className="nowrap">{fmtMobile(u.mobile)}</td>
                <td><span className={`chip${u.role.isSuperAdmin ? " brand" : ""}`}>{t.lang === "en" ? u.role.nameEn : u.role.nameGu}</span></td>
                <td className="nowrap">{u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : t("never")}</td>
                <td>{u.isActive ? <span className="chip ok">{t("active")}</span> : <span className="chip bad">{t("inactive")}</span>}{u.lockedUntil && u.lockedUntil > new Date() ? <> <span className="chip gold">🔒</span></> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

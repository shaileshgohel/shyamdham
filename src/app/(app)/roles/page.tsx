import Link from "next/link";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { ACTIONS, MODULES, type PermissionMap } from "@/lib/permissions";

export const metadata = { title: "રોલ" };

export default async function RolesPage() {
  const me = await requirePage("users", "view");
  const t = await getT();
  const en = t.lang === "en";
  const roles = await db.role.findMany({ orderBy: { id: "asc" }, include: { _count: { select: { users: { where: { isActive: true } } } } } });
  return (
    <>
      <div className="pagehead">
        <div><h1>{t("roles_title")}</h1><p className="muted small" style={{ maxWidth: 720 }}>{t("roles_intro")}</p></div>
        {me.role.isSuperAdmin && <Link className="btn pri" href="/roles/new">{en ? "+ New role" : "+ નવો રોલ"}</Link>}
      </div>
      <div className="tablewrap">
        <table className="t">
          <thead><tr><th>{t("module")}</th>{roles.map((r) => <th key={r.id} className="c"><Link href={`/roles/${r.id}`}>{en ? r.nameEn : r.nameGu}</Link><br /><span className="small muted">{r._count.users} {t("nav_users")}</span></th>)}</tr></thead>
          <tbody>
            {MODULES.map((m) => (
              <tr key={m.key}>
                <td>{en ? m.en : m.gu} {!m.ready && <span className="chip">{t("nav_soon")}</span>}</td>
                {roles.map((r) => {
                  const a = r.isSuperAdmin ? ACTIONS.map((x) => x.key) : ((r.permissions as PermissionMap)[m.key] ?? []);
                  const label = a.length === 4 ? (en ? "Full" : "પૂરા") : a.map((k) => ACTIONS.find((x) => x.key === k)![en ? "en" : "gu"]).join(", ");
                  return <td key={r.id} className="c small">{label || <span className="muted">–</span>}</td>;
                })}
              </tr>
            ))}
            <tr><td>{t("nav_audit")}</td>{roles.map((r) => <td key={r.id} className="c small">{r.isSuperAdmin ? (en ? "Yes" : "હા") : <span className="muted">–</span>}</td>)}</tr>
          </tbody>
        </table>
      </div>
      <p className="small muted">{t("super_admin_all")}</p>
    </>
  );
}

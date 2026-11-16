import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { can, canReadAudit } from "@/lib/permissions";
import { AuditTable } from "@/components/audit-table";
import { istDayStart, todayIST } from "@/lib/format";

export const metadata = { title: "ડેશબોર્ડ" };

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ denied?: string; pw?: string }> }) {
  const user = await requireUser();
  const t = await getT();
  const sp = await searchParams;
  const canMembers = can(user.role, "members", "view");
  const superAdmin = canReadAudit(user.role);
  const monthStart = istDayStart(todayIST().slice(0, 8) + "01");

  const [families, members, newThisMonth, activeUsers, byArea, recent] = await Promise.all([
    canMembers ? db.family.count({ where: { isActive: true } }) : 0,
    canMembers ? db.member.count({ where: { family: { isActive: true }, isAlive: true } }) : 0,
    canMembers ? db.family.count({ where: { isActive: true, createdAt: { gte: monthStart } } }) : 0,
    superAdmin ? db.user.count({ where: { isActive: true } }) : 0,
    canMembers ? db.family.groupBy({ by: ["area"], where: { isActive: true }, _count: { _all: true }, orderBy: { _count: { area: "desc" } }, take: 8 }) : [],
    superAdmin ? db.auditLog.findMany({ orderBy: { at: "desc" }, take: 8 }) : [],
  ]);
  const maxArea = Math.max(1, ...byArea.map((a) => a._count._all));

  return (
    <>
      {sp.denied && <p className="alert bad">{t("denied_page")}</p>}
      {sp.pw && <p className="alert ok">{t("password_changed")}</p>}
      <div className="pagehead">
        <div><h1>{t("dash_title")}</h1><p className="muted">{t.lang === "en" ? "Welcome" : "નમસ્તે"}, {user.fullName}</p></div>
        {can(user.role, "members", "create") && <Link className="btn pri" href="/members/new">{t("quick_new_family")}</Link>}
      </div>

      {canMembers && (
        <div className="kpis">
          <div className="kpi"><span>{t("dash_families")}</span><b>{families.toLocaleString("en-IN")}</b></div>
          <div className="kpi"><span>{t("dash_members")}</span><b>{members.toLocaleString("en-IN")}</b></div>
          <div className="kpi"><span>{t("dash_new_month")}</span><b>{newThisMonth.toLocaleString("en-IN")}</b></div>
          {superAdmin && <div className="kpi"><span>{t("dash_users")}</span><b>{activeUsers}</b></div>}
        </div>
      )}

      <div className="grid2">
        {canMembers && byArea.length > 0 && (
          <section className="card">
            <h2>{t("dash_by_area")}</h2>
            <div className="hbars">
              {byArea.map((a) => (
                <Link key={a.area ?? "-"} href={a.area ? `/members?area=${encodeURIComponent(a.area)}` : "/members"} className="hbar" style={{ color: "inherit", textDecoration: "none" }}>
                  <span>{a.area ?? "—"}</span>
                  <span className="track"><i style={{ width: `${(a._count._all / maxArea) * 100}%` }} /></span>
                  <span className="num">{a._count._all}</span>
                </Link>
              ))}
            </div>
          </section>
        )}
        <section className="card">
          <h2>{t("dash_coming")}</h2>
          <p className="muted">{t("dash_coming_text")}</p>
        </section>
      </div>

      {superAdmin && recent.length > 0 && (
        <section className="card">
          <div className="pagehead"><h2>{t("dash_recent")}</h2><Link href="/audit" className="small">{t("nav_audit")} ›</Link></div>
          <AuditTable rows={recent} t={t} />
        </section>
      )}
    </>
  );
}

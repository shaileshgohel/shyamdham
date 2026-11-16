import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { can, canReadAudit } from "@/lib/permissions";
import { EditUserForm } from "../user-forms";
import { AuditTable } from "@/components/audit-table";

export const metadata = { title: "યુઝર" };

export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePage("users", "view");
  const t = await getT();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const user = await db.user.findUnique({ where: { id }, include: { role: true } });
  if (!user) notFound();
  const roles = await db.role.findMany({ where: me.role.isSuperAdmin ? {} : { isSuperAdmin: false }, orderBy: { id: "asc" } });
  const canEdit = can(me.role, "users", "edit") && (!user.role.isSuperAdmin || me.role.isSuperAdmin);
  const logs = canReadAudit(me.role) ? await db.auditLog.findMany({ where: { userId: id }, orderBy: { at: "desc" }, take: 30 }) : [];
  return (
    <>
      <div className="pagehead">
        <div><span className="muted">{user.username}</span><h1>{user.fullName}</h1></div>
        <Link className="btn" href="/users">{t("back")}</Link>
      </div>
      <EditUserForm
        canEdit={canEdit}
        roles={(user.role.isSuperAdmin && !me.role.isSuperAdmin ? [user.role] : roles).map((r) => ({ id: r.id, label: t.lang === "en" ? r.nameEn : r.nameGu }))}
        user={{ id: user.id, fullName: user.fullName, username: user.username, mobile: user.mobile ?? "", roleId: user.roleId, isActive: user.isActive }}
      />
      {logs.length > 0 && (
        <section className="card">
          <h2>{t.lang === "en" ? "Recent activity by this user" : "આ યુઝરની છેલ્લી પ્રવૃત્તિ"}</h2>
          <AuditTable rows={logs} t={t} />
        </section>
      )}
    </>
  );
}

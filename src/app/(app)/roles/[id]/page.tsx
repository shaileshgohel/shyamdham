import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { ACTIONS, MODULES, type PermissionMap } from "@/lib/permissions";
import { RoleForm } from "../role-form";

export const metadata = { title: "રોલ" };

export default async function RolePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const me = await requirePage("users", "view");
  const t = await getT();
  const en = t.lang === "en";
  const { id } = await params;
  const { saved } = await searchParams;
  const role = id === "new" ? null : await db.role.findUnique({ where: { id: Number(id) || 0 }, include: { users: { where: { isActive: true }, select: { id: true, fullName: true } } } });
  if (id !== "new" && !role) notFound();
  if (id === "new" && !me.role.isSuperAdmin) notFound();
  const perms = role?.isSuperAdmin
    ? Object.fromEntries(MODULES.map((m) => [m.key, ACTIONS.map((a) => a.key)]))
    : ((role?.permissions as PermissionMap) ?? {});
  return (
    <>
      <div className="pagehead">
        <div><h1>{role ? (en ? role.nameEn : role.nameGu) : en ? "New role" : "નવો રોલ"}</h1></div>
        <Link className="btn" href="/roles">{t("back")}</Link>
      </div>
      {role?.isSuperAdmin && <p className="alert info">{t("super_admin_all")}</p>}
      <RoleForm
        id={role ? String(role.id) : "new"}
        nameGu={role?.nameGu ?? ""}
        nameEn={role?.nameEn ?? ""}
        perms={perms as Record<string, string[]>}
        modules={MODULES.map((m) => ({ key: m.key, label: en ? m.en : m.gu, ready: m.ready }))}
        actions={ACTIONS.map((a) => ({ key: a.key, label: en ? a.en : a.gu }))}
        editable={me.role.isSuperAdmin && !role?.isSuperAdmin}
        saved={!!saved}
      />
      {role && role.users.length > 0 && (
        <section className="card">
          <h2>{t("users_in_role")}</h2>
          <p>{role.users.map((u, i) => <span key={u.id}>{i > 0 && ", "}<Link href={`/users/${u.id}`}>{u.fullName}</Link></span>)}</p>
        </section>
      )}
    </>
  );
}

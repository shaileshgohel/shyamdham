import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { NewUserForm } from "../user-forms";

export const metadata = { title: "નવો યુઝર" };

export default async function NewUserPage() {
  const me = await requirePage("users", "create");
  const t = await getT();
  const roles = await db.role.findMany({ where: me.role.isSuperAdmin ? {} : { isSuperAdmin: false }, orderBy: { id: "asc" } });
  return (
    <>
      <div className="pagehead"><div><h1>{t("user_new_title")}</h1></div></div>
      <NewUserForm roles={roles.map((r) => ({ id: r.id, label: t.lang === "en" ? r.nameEn : r.nameGu }))} />
    </>
  );
}

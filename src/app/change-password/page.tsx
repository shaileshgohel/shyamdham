import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { LangProvider } from "@/components/i18n-client";
import { ChangePasswordForm } from "./cp-form";
import { logoutAction } from "../login/actions";

export const metadata = { title: "પાસવર્ડ" };

export default async function ChangePasswordPage() {
  const user = await requireUser({ allowPasswordChange: true });
  const t = await getT();
  return (
    <LangProvider lang={t.lang}>
      <main className="login-wrap">
        <div className="login-card">
          <div className="brand">
            <b>{t("app_name")}</b>
            <span>{user.fullName}</span>
          </div>
          <h1 style={{ fontSize: 20 }}>{user.mustChangePassword ? t("cp_title") : t("change_password")}</h1>
          {user.mustChangePassword && <p className="muted small">{t("cp_intro")}</p>}
          <ChangePasswordForm />
          <div className="btns" style={{ justifyContent: "space-between" }}>
            {!user.mustChangePassword && <Link href="/dashboard" className="small">{t("back")}</Link>}
            <form action={logoutAction}><button className="linkbtn small">{t("logout")}</button></form>
          </div>
        </div>
      </main>
    </LangProvider>
  );
}

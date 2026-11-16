import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { LangProvider } from "@/components/i18n-client";
import { LoginForm } from "./login-form";

export const metadata = { title: "લોગિન" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  const t = await getT();
  return (
    <LangProvider lang={t.lang}>
      <main className="login-wrap">
        <div className="login-card">
          <div className="brand">
            <b>{t("app_name")}</b>
            <span>{t("app_sub")}</span>
          </div>
          <h1 style={{ fontSize: 20 }}>{t("login_title")}</h1>
          <LoginForm />
          <a className="small" href={`/lang?to=${t.lang === "en" ? "gu" : "en"}&back=/login`} style={{ textAlign: "center" }}>
            {t("switch_lang")}
          </a>
        </div>
      </main>
    </LangProvider>
  );
}

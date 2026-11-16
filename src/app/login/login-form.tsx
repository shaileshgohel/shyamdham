"use client";
import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";
import { useT } from "@/components/i18n-client";
import { SubmitButton } from "@/components/submit-button";

export function LoginForm() {
  const t = useT();
  const [state, action] = useActionState<LoginState, FormData>(loginAction, {});
  return (
    <form action={action} className="form">
      {state.error && <p className="alert bad" role="alert">{t(state.error)}</p>}
      <div className="field">
        <label htmlFor="username">{t("username")}</label>
        <input id="username" name="username" type="text" autoComplete="username" autoCapitalize="none" defaultValue={state.username} required autoFocus />
      </div>
      <div className="field">
        <label htmlFor="password">{t("password")}</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <SubmitButton>{t("login_button")}</SubmitButton>
    </form>
  );
}

"use client";
import { useActionState } from "react";
import { changePasswordAction, type CpState } from "./actions";
import { useT } from "@/components/i18n-client";
import { SubmitButton } from "@/components/submit-button";

export function ChangePasswordForm() {
  const t = useT();
  const [state, action] = useActionState<CpState, FormData>(changePasswordAction, {});
  return (
    <form action={action} className="form">
      {state.error && <p className="alert bad" role="alert">{t(state.error)}</p>}
      <div className="field">
        <label htmlFor="current">{t("current_password")}</label>
        <input id="current" name="current" type="password" autoComplete="current-password" required />
      </div>
      <div className="field">
        <label htmlFor="next">{t("new_password")}</label>
        <input id="next" name="next" type="password" autoComplete="new-password" required minLength={8} />
        <span className="help">{t("pw_rule")}</span>
      </div>
      <div className="field">
        <label htmlFor="confirm">{t("confirm_password")}</label>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} />
      </div>
      <SubmitButton>{t("save")}</SubmitButton>
    </form>
  );
}

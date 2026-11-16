"use client";
import { useActionState } from "react";
import Link from "next/link";
import { useT } from "@/components/i18n-client";
import { SubmitButton } from "@/components/submit-button";
import { createUserAction, resetPasswordAction, updateUserAction, type UserFormState } from "./actions";

type RoleOpt = { id: number; label: string };
type UserVal = { id: number; fullName: string; username: string; mobile: string; roleId: number; isActive: boolean };

function TempPw({ state }: { state: UserFormState }) {
  const t = useT();
  if (!state.tempPassword) return null;
  return (
    <div className="alert ok" role="status">
      <p>{t("username")}: <b>{state.username}</b></p>
      <p>{t("temp_password")}: <b style={{ fontFamily: "monospace", fontSize: 16, userSelect: "all" }}>{state.tempPassword}</b></p>
      <p className="small">{t("temp_password_help")}</p>
    </div>
  );
}

export function NewUserForm({ roles }: { roles: RoleOpt[] }) {
  const t = useT();
  const [state, action] = useActionState<UserFormState, FormData>(createUserAction, {});
  const fe = state.fieldErrors ?? {};
  if (state.ok)
    return (
      <div className="card">
        <p>{t("user_created", { u: state.username ?? "" })}</p>
        <TempPw state={state} />
        <div className="btns"><Link className="btn pri" href="/users">{t("users_title")}</Link><Link className="btn" href={`/users/${state.userId}`}>{t("view")}</Link></div>
      </div>
    );
  return (
    <form action={action} className="card form">
      {state.error && <p className="alert bad">{t(state.error)}</p>}
      <div className="fields">
        <div className="field"><label htmlFor="fullName">{t("full_name")} <span className="req">*</span></label><input id="fullName" name="fullName" type="text" required className={fe.fullName ? "bad" : undefined} />{fe.fullName && <span className="err">{t(fe.fullName)}</span>}</div>
        <div className="field"><label htmlFor="username">{t("username")} <span className="req">*</span></label><input id="username" name="username" type="text" autoCapitalize="none" required className={fe.username ? "bad" : undefined} /><span className="help">{t("username_help")}</span>{fe.username && <span className="err">{t(fe.username)}</span>}</div>
        <div className="field"><label htmlFor="mobile">{t("mobile")}</label><input id="mobile" name="mobile" type="tel" className={fe.mobile ? "bad" : undefined} />{fe.mobile && <span className="err">{t(fe.mobile)}</span>}</div>
        <div className="field"><label htmlFor="roleId">{t("role")} <span className="req">*</span></label><select id="roleId" name="roleId" required defaultValue="">{<option value="" disabled>{t("choose")}</option>}{roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select></div>
      </div>
      <p className="small muted">{t("temp_password_help")}</p>
      <div className="btns"><SubmitButton>{t("save")}</SubmitButton><Link className="btn" href="/users">{t("cancel")}</Link></div>
    </form>
  );
}

export function EditUserForm({ user, roles, canEdit }: { user: UserVal; roles: RoleOpt[]; canEdit: boolean }) {
  const t = useT();
  const [state, action] = useActionState<UserFormState, FormData>(updateUserAction, {});
  const [reset, resetAction] = useActionState<UserFormState, FormData>(resetPasswordAction, {});
  const fe = state.fieldErrors ?? {};
  return (
    <>
      <form action={action} className="card form">
        <input type="hidden" name="id" value={user.id} />
        {state.ok && <p className="alert ok">{t("saved")}</p>}
        {state.error && <p className="alert bad">{t(state.error)}</p>}
        <fieldset disabled={!canEdit} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="fields">
            <div className="field"><label htmlFor="fullName">{t("full_name")}</label><input id="fullName" name="fullName" type="text" defaultValue={user.fullName} required /></div>
            <div className="field"><label>{t("username")}</label><input type="text" value={user.username} readOnly /></div>
            <div className="field"><label htmlFor="mobile">{t("mobile")}</label><input id="mobile" name="mobile" type="tel" defaultValue={user.mobile} className={fe.mobile ? "bad" : undefined} />{fe.mobile && <span className="err">{t(fe.mobile)}</span>}</div>
            <div className="field"><label htmlFor="roleId">{t("role")}</label><select id="roleId" name="roleId" defaultValue={user.roleId}>{roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select></div>
            <div className="field"><label>&nbsp;</label><label className="check"><input type="checkbox" name="isActive" defaultChecked={user.isActive} /> {t("user_active")}</label></div>
          </div>
        </fieldset>
        {canEdit && <div className="btns"><SubmitButton>{t("save")}</SubmitButton></div>}
      </form>
      {canEdit && (
        <form action={resetAction} className="card">
          <input type="hidden" name="id" value={user.id} />
          <h2>{t("reset_password")}</h2>
          {reset.error && <p className="alert bad">{t(reset.error)}</p>}
          <TempPw state={reset} />
          <div><SubmitButton className="btn">{t("reset_password")}</SubmitButton></div>
        </form>
      )}
    </>
  );
}

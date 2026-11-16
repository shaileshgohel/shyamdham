"use client";
import { useActionState, useState } from "react";
import { useT } from "@/components/i18n-client";
import { SubmitButton } from "@/components/submit-button";
import { setFamilyActiveAction, type ActiveState } from "../actions";

export function ActiveToggle({ familyId, active }: { familyId: number; active: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<ActiveState, FormData>(setFamilyActiveAction, {});

  if (active && !open)
    return <div><button className="btn danger" onClick={() => setOpen(true)}>{t("deactivate_family")}</button></div>;

  return (
    <form action={action} className="card">
      <input type="hidden" name="familyId" value={familyId} />
      <input type="hidden" name="active" value={active ? "0" : "1"} />
      {state.error && <p className="alert bad">{t(state.error)}</p>}
      {active ? (
        <>
          <label htmlFor="reason">{t("deactivate_confirm")}</label>
          <input id="reason" name="reason" type="text" required maxLength={300} />
          <div className="btns">
            <SubmitButton className="btn danger">{t("confirm")}</SubmitButton>
            <button type="button" className="btn" onClick={() => setOpen(false)}>{t("cancel")}</button>
          </div>
        </>
      ) : (
        <div className="btns"><SubmitButton className="btn">{t("reactivate_family")}</SubmitButton></div>
      )}
    </form>
  );
}

"use client";
import { ActionForm, Submit, type ActionResult } from "./action-form";
import { CancelToggle } from "./cancel-toggle";

/** "Cancel …" button that opens a reason form and calls the given server action with { id, reason }. */
export function CancelForm({ action, id, buttonLabel, intro, reasonLabel, confirmLabel }: { action: (p: ActionResult, fd: FormData) => Promise<ActionResult>; id: number; buttonLabel: string; intro?: string; reasonLabel: string; confirmLabel: string }) {
  return (
    <CancelToggle label={buttonLabel}>
      <ActionForm action={action} className="card form">
        {(_s, pending) => (
          <>
            <input type="hidden" name="id" value={id} />
            {intro && <p>{intro}</p>}
            <div className="field"><label htmlFor="reason">{reasonLabel}</label><input id="reason" name="reason" type="text" required maxLength={300} /></div>
            <div className="btns"><Submit pending={pending} className="btn danger">{confirmLabel}</Submit></div>
          </>
        )}
      </ActionForm>
    </CancelToggle>
  );
}

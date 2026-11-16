"use client";
import { ActionForm, Submit } from "@/components/action-form";
import { useG } from "@/components/i18n-client";
import { saveSettingsAction } from "../accounts/actions";

export function SettingsForm({ fields }: { fields: { key: string; label: string; value: string; long: boolean }[] }) {
  const g = useG();
  return (
    <ActionForm action={saveSettingsAction} className="card form">
      {(_s, pending) => (
        <>
          <div className="fields">
            {fields.map((f) => (
              <div key={f.key} className={`field${f.long ? " wide" : ""}`}>
                <label htmlFor={f.key}>{f.label}</label>
                {f.long ? <textarea id={f.key} name={f.key} defaultValue={f.value} /> : <input id={f.key} name={f.key} type="text" defaultValue={f.value} />}
              </div>
            ))}
          </div>
          <div className="btns"><Submit pending={pending}>{g("સેવ કરો", "Save")}</Submit></div>
        </>
      )}
    </ActionForm>
  );
}

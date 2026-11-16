"use client";
import { useActionState } from "react";
import { useT } from "@/components/i18n-client";
import { SubmitButton } from "@/components/submit-button";
import { saveRoleAction, type RoleState } from "./actions";

type Mod = { key: string; label: string; ready: boolean };
type Act = { key: string; label: string };

export function RoleForm({ id, nameGu, nameEn, perms, modules, actions, editable, saved }: { id: string; nameGu: string; nameEn: string; perms: Record<string, string[]>; modules: Mod[]; actions: Act[]; editable: boolean; saved?: boolean }) {
  const t = useT();
  const [state, action] = useActionState<RoleState, FormData>(saveRoleAction, {});
  return (
    <form action={action} className="card form">
      <input type="hidden" name="id" value={id} />
      {(state.ok || saved) && <p className="alert ok">{t("saved")}</p>}
      {state.error && <p className="alert bad">{t(state.error)}</p>}
      <fieldset disabled={!editable} style={{ border: 0, padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="fields">
          <div className="field"><label htmlFor="nameGu">{t("name")} (ગુજરાતી)</label><input id="nameGu" name="nameGu" type="text" defaultValue={nameGu} required /></div>
          <div className="field"><label htmlFor="nameEn">{t("name")} (English)</label><input id="nameEn" name="nameEn" type="text" defaultValue={nameEn} /></div>
        </div>
        <div className="tablewrap matrix">
          <table className="t">
            <thead><tr><th>{t("module")}</th>{actions.map((a) => <th key={a.key} className="c">{a.label}</th>)}</tr></thead>
            <tbody>
              {modules.map((m) => (
                <tr key={m.key}>
                  <td>{m.label} {!m.ready && <span className="chip">{t("nav_soon")}</span>}</td>
                  {actions.map((a) => (
                    <td key={a.key} className="c">
                      <input type="checkbox" name={`p.${m.key}.${a.key}`} defaultChecked={perms[m.key]?.includes(a.key)} aria-label={`${m.label} ${a.label}`} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </fieldset>
      {editable && <div className="btns"><SubmitButton>{t("save")}</SubmitButton></div>}
    </form>
  );
}

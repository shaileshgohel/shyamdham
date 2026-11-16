"use client";
import { useActionState } from "react";
import Link from "next/link";
import { useT } from "@/components/i18n-client";
import { SubmitButton } from "@/components/submit-button";
import { checkImportAction, commitImportAction, type ImportState } from "./actions";

export function ImportClient() {
  const t = useT();
  const [checked, check] = useActionState<ImportState, FormData>(checkImportAction, {});
  const [committed, commit] = useActionState<ImportState, FormData>(commitImportAction, {});

  if (committed.done)
    return (
      <div className="card">
        <p className="alert ok" role="status">{t("import_done", { f: committed.done.families, m: committed.done.members })}</p>
        <div className="btns"><Link className="btn pri" href="/members">{t("dir_title")}</Link></div>
      </div>
    );

  const p = checked.preview;
  return (
    <>
      <section className="card">
        <p>{t("import_step1")}</p>
        <div><a className="btn" href="/members-template">{t("download_template")}</a></div>
        <p>{t("import_step2")}</p>
        <form action={check} className="btns">
          <input type="file" name="file" accept=".xlsx,.csv" required aria-label="file" />
          <SubmitButton className="btn pri">{t("check_file")}</SubmitButton>
        </form>
        {checked.error && <p className="alert bad">{t(checked.error)}</p>}
      </section>

      {p && (
        <section className="card">
          <h2>{checked.fileName}</h2>
          {checked.problems?.length ? (
            <>
              <p className="alert bad">{t("import_err_rows", { n: checked.problems.length })}</p>
              <div className="tablewrap">
                <table className="t">
                  <thead><tr><th className="num">{t("row")}</th><th>{t("problem")}</th></tr></thead>
                  <tbody>{checked.problems.map((x, i) => <tr key={i}><td className="num">{x.rowNo}</td><td>{x.message}</td></tr>)}</tbody>
                </table>
              </div>
            </>
          ) : (
            <>
              <p className="alert ok">{t("import_ok_rows", { f: p.familyCount, m: p.memberCount })}</p>
              <div className="tablewrap">
                <table className="t">
                  <thead><tr><th>{t("head_name")}</th><th className="num">{t("members_count")}</th><th>{t("area")}</th></tr></thead>
                  <tbody>{p.sample.map((s, i) => <tr key={i}><td>{s.name}</td><td className="num">{s.members}</td><td>{s.area}</td></tr>)}</tbody>
                </table>
              </div>
              <p>{t("import_step3")}</p>
              <form action={commit}>
                <input type="hidden" name="payload" value={checked.payload} />
                <input type="hidden" name="fileName" value={checked.fileName} />
                {committed.error && <p className="alert bad">{t(committed.error)}</p>}
                <SubmitButton>{t("do_import", { n: p.familyCount })}</SubmitButton>
              </form>
            </>
          )}
        </section>
      )}
    </>
  );
}

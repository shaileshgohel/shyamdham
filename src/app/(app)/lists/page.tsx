import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { MASTER_TYPES } from "@/lib/format";
import { addMasterValueAction, removeMasterValueAction } from "./actions";

export const metadata = { title: "યાદીઓ" };

export default async function ListsPage() {
  await requirePage("members", "edit");
  const t = await getT();
  const rows = await db.masterValue.findMany({ orderBy: [{ sortOrder: "asc" }, { value: "asc" }] });
  return (
    <>
      <div className="pagehead"><div><h1>{t("lists_title")}</h1><p className="muted small">{t("lists_intro")}</p></div></div>
      <div className="grid2">
        {MASTER_TYPES.map((type) => (
          <section key={type} className="card">
            <h2>{t(`list_${type}`)}</h2>
            <form action={addMasterValueAction} className="btns">
              <input type="hidden" name="type" value={type} />
              <input type="text" name="value" placeholder={t("new_value")} aria-label={t("new_value")} required style={{ flex: 1, minWidth: 140 }} />
              <button className="btn" type="submit">{t("add")}</button>
            </form>
            <div className="btns">
              {rows.filter((r) => r.type === type).map((r) => (
                <form key={r.id} action={removeMasterValueAction} style={{ display: "inline-flex" }}>
                  <input type="hidden" name="id" value={r.id} />
                  <span className="chip" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                    {r.value}
                    <button type="submit" className="linkbtn" aria-label={`${t("remove")} ${r.value}`} title={t("remove")} style={{ textDecoration: "none" }}>×</button>
                  </span>
                </form>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

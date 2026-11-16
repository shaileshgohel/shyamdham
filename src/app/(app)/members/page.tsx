import Link from "next/link";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { can } from "@/lib/permissions";
import { familyWhere, masterLists, memberWhere, parseFilters } from "@/lib/members";
import { BLOOD_GROUPS, fmtMobile, fullName } from "@/lib/format";

export const metadata = { title: "સભ્યો" };
const PAGE = 25;

export default async function MembersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePage("members", "view");
  const t = await getT();
  const sp = await searchParams;
  const f = parseFilters(sp);
  const view = sp.view === "people" ? "people" : "families";
  const page = Math.max(1, Number(sp.page) || 1);
  const lists = await masterLists();

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries({ q: f.q, vatan: f.vatan, area: f.area, occupation: f.occupation, blood: f.bloodGroup, inactive: f.inactive ? "1" : undefined, view: view === "people" ? "people" : undefined }))
    if (v) qs.set(k, v);
  const withPage = (p: number) => { const q = new URLSearchParams(qs); if (p > 1) q.set("page", String(p)); return `/members?${q}`; };
  const filterQs = qs.toString();

  let total = 0;
  let rows: React.ReactNode;
  if (view === "families") {
    const where = familyWhere(f);
    const [count, families] = await Promise.all([
      db.family.count({ where }),
      db.family.findMany({
        where,
        orderBy: { familyNo: "asc" },
        skip: (page - 1) * PAGE,
        take: PAGE,
        include: { members: { orderBy: { sortOrder: "asc" }, select: { firstName: true, fatherName: true, surname: true, mobile: true, isHead: true, occupation: true } }, _count: { select: { members: true } } },
      }),
    ]);
    total = count;
    rows = (
      <table className="t">
        <thead><tr><th>{t("family_no")}</th><th>{t("head_name")}</th><th>{t("vatan")}</th><th>{t("area")}</th><th>{t("mobile")}</th><th className="num">{t("members_count")}</th><th>{t("occupation")}</th></tr></thead>
        <tbody>
          {families.map((fam) => {
            const head = fam.members.find((m) => m.isHead) ?? fam.members[0];
            return (
              <tr key={fam.id} className={fam.isActive ? undefined : "dim"}>
                <td className="nowrap"><Link href={`/members/${fam.id}`}>{fam.familyNo}</Link></td>
                <td><Link href={`/members/${fam.id}`}>{head ? fullName(head) : "—"}</Link>{!fam.isActive && <> <span className="chip bad">{t("inactive")}</span></>}</td>
                <td>{fam.vatan}</td>
                <td>{fam.area}</td>
                <td className="nowrap">{fmtMobile(head?.mobile)}</td>
                <td className="num">{fam._count.members}</td>
                <td>{head?.occupation}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  } else {
    const where = memberWhere(f);
    const [count, people] = await Promise.all([
      db.member.count({ where }),
      db.member.findMany({
        where,
        orderBy: [{ family: { familyNo: "asc" } }, { sortOrder: "asc" }],
        skip: (page - 1) * PAGE,
        take: PAGE,
        include: { family: { select: { id: true, familyNo: true, area: true, vatan: true, isActive: true } } },
      }),
    ]);
    total = count;
    rows = (
      <table className="t">
        <thead><tr><th>{t("family_no")}</th><th>{t("name")}</th><th>{t("relation")}</th><th>{t("mobile")}</th><th>{t("blood_group")}</th><th>{t("education")}</th><th>{t("occupation")}</th><th>{t("area")}</th></tr></thead>
        <tbody>
          {people.map((m) => (
            <tr key={m.id} className={m.family.isActive && m.isAlive ? undefined : "dim"}>
              <td className="nowrap"><Link href={`/members/${m.family.id}`}>{m.family.familyNo}</Link></td>
              <td>{fullName(m)}{!m.isAlive && <> <span className="chip">{t("deceased")}</span></>}</td>
              <td>{m.relation}</td>
              <td className="nowrap">{fmtMobile(m.mobile)}</td>
              <td>{m.bloodGroup}</td>
              <td>{m.education}</td>
              <td>{m.occupation}</td>
              <td>{m.family.area}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  const from = total ? (page - 1) * PAGE + 1 : 0;
  const to = Math.min(total, page * PAGE);
  const viewLink = (v: string) => { const q = new URLSearchParams(qs); q.delete("view"); if (v === "people") q.set("view", "people"); return `/members?${q}`; };

  return (
    <>
      <div className="pagehead">
        <div><h1>{t("dir_title")}</h1></div>
        <div className="btns">
          <a className="btn" href={`/members-export?${filterQs}`}>{t("export_excel")}</a>
          <Link className="btn" href={`/members/print?${filterQs}`}>{t("print_directory")}</Link>
          {can(user.role, "members", "create") && <Link className="btn" href="/members/import">{t("import")}</Link>}
          {can(user.role, "members", "create") && <Link className="btn pri" href="/members/new">{t("quick_new_family")}</Link>}
        </div>
      </div>

      <form className="card" method="get" action="/members">
        {view === "people" && <input type="hidden" name="view" value="people" />}
        <div className="filters">
          <div className="field"><label htmlFor="q">{t("search")}</label><input id="q" name="q" type="search" defaultValue={f.q} placeholder={t("dir_search_ph")} /></div>
          <Select id="vatan" label={t("vatan")} all={t("all")} values={lists.VATAN} value={f.vatan} />
          <Select id="area" label={t("area")} all={t("all")} values={lists.AREA} value={f.area} />
          <Select id="occupation" label={t("occupation")} all={t("all")} values={lists.OCCUPATION} value={f.occupation} />
          <Select id="blood" label={t("blood_group")} all={t("all")} values={BLOOD_GROUPS} value={f.bloodGroup} />
          <button className="btn pri" type="submit">{t("search")}</button>
        </div>
        <label className="check small"><input type="checkbox" name="inactive" value="1" defaultChecked={f.inactive} /> {t("show_inactive")}</label>
      </form>

      <div className="btns" role="tablist">
        <Link href={viewLink("families")} className={`btn sm${view === "families" ? " pri" : ""}`}>{t.lang === "en" ? "Families" : "પરિવાર"}</Link>
        <Link href={viewLink("people")} className={`btn sm${view === "people" ? " pri" : ""}`}>{t.lang === "en" ? "People" : "વ્યક્તિ"}</Link>
      </div>

      <div className="tablewrap">{total ? rows : <p style={{ padding: 16 }} className="muted">{t("none_found")}</p>}</div>
      <div className="pager">
        <span>{t("showing", { from, to, total })}</span>
        <div className="btns">
          {page > 1 && <Link className="btn sm" href={withPage(page - 1)}>{t("prev")}</Link>}
          {to < total && <Link className="btn sm" href={withPage(page + 1)}>{t("next")}</Link>}
        </div>
      </div>
    </>
  );
}

function Select({ id, label, all, values, value }: { id: string; label: string; all: string; values: string[]; value?: string }) {
  const opts = value && !values.includes(value) ? [value, ...values] : values;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} name={id} defaultValue={value ?? ""}>
        <option value="">{all}</option>
        {opts.map((v) => <option key={v}>{v}</option>)}
      </select>
    </div>
  );
}

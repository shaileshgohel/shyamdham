import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { canReadAudit } from "@/lib/permissions";
import { AuditTable } from "@/components/audit-table";
import { AUDIT_ACTIONS, AUDIT_ENTITIES, auditWhere, parseAuditFilters } from "@/lib/audit-query";
import { istDayStart, todayIST } from "@/lib/format";
import { isDictKey } from "@/lib/i18n-dict";

export const metadata = { title: "ઓડિટ લોગ" };
const PAGE = 50;

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requireUser();
  if (!canReadAudit(me.role)) redirect("/dashboard?denied=1");
  const t = await getT();
  const sp = await searchParams;
  const f = parseAuditFilters(sp);
  const page = Math.max(1, Number(sp.page) || 1);
  const where = auditWhere(f);

  const today = istDayStart(todayIST());
  const [total, rows, users, todayByUser] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({ where, orderBy: { at: "desc" }, skip: (page - 1) * PAGE, take: PAGE }),
    db.user.findMany({ orderBy: { fullName: "asc" }, select: { id: true, fullName: true } }),
    db.auditLog.groupBy({ by: ["userName"], where: { at: { gte: today }, action: { in: ["create", "edit", "import", "cancel"] } }, _count: { _all: true } }),
  ]);

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v) qs.set(k, String(v));
  const withPage = (p: number) => { const q = new URLSearchParams(qs); if (p > 1) q.set("page", String(p)); return `/audit?${q}`; };
  const lbl = (p: string, k: string) => { const key = `${p}_${k}`; return isDictKey(key) ? t(key) : k; };
  const from = total ? (page - 1) * PAGE + 1 : 0;
  const to = Math.min(total, page * PAGE);

  return (
    <>
      <div className="pagehead">
        <div><h1>{t("audit_title")}</h1><p className="muted small" style={{ maxWidth: 720 }}>{t("audit_intro")}</p></div>
        <a className="btn" href={`/audit-export?${qs}`}>{t("export_excel")}</a>
      </div>

      {todayByUser.length > 0 && (
        <div className="kpis">
          {todayByUser.map((u) => (
            <div key={u.userName} className="kpi"><span>{u.userName} · {t("today_by_user")}</span><b>{u._count._all} {t("entries")}</b></div>
          ))}
        </div>
      )}

      <form className="card" method="get" action="/audit">
        <div className="fields">
          <div className="field"><label htmlFor="user">{t("user")}</label><select id="user" name="user" defaultValue={f.user ?? ""}><option value="">{t("all")}</option>{users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}</select></div>
          <div className="field"><label htmlFor="entity">{t("type")}</label><select id="entity" name="entity" defaultValue={f.entity ?? ""}><option value="">{t("all")}</option>{AUDIT_ENTITIES.map((e) => <option key={e} value={e}>{lbl("ent", e)}</option>)}</select></div>
          <div className="field"><label htmlFor="action">{t("action")}</label><select id="action" name="action" defaultValue={f.action ?? ""}><option value="">{t("all")}</option>{AUDIT_ACTIONS.map((a) => <option key={a} value={a}>{lbl("act", a)}</option>)}</select></div>
          <div className="field"><label htmlFor="from">{t("from_date")}</label><input id="from" name="from" type="date" defaultValue={f.from} /></div>
          <div className="field"><label htmlFor="to">{t("to_date")}</label><input id="to" name="to" type="date" defaultValue={f.to} /></div>
          <div className="field"><label htmlFor="q">{t("document")} / {t("details")}</label><input id="q" name="q" type="search" defaultValue={f.q} /></div>
        </div>
        <div className="btns"><button className="btn pri" type="submit">{t("filter")}</button><Link className="btn" href="/audit">{t("all")}</Link></div>
      </form>

      {total ? <AuditTable rows={rows} t={t} /> : <p className="muted">{t("none_found")}</p>}
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

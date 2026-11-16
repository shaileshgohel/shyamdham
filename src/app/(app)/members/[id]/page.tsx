import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { can, canReadAudit } from "@/lib/permissions";
import { fmtDate, fmtDateTime, fmtMobile, fullName } from "@/lib/format";
import { ActiveToggle } from "./active-toggle";
import { AuditTable } from "@/components/audit-table";

export const metadata = { title: "પરિવાર" };

export default async function FamilyPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const user = await requirePage("members", "view");
  const t = await getT();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const { saved } = await searchParams;
  const fam = await db.family.findUnique({ where: { id }, include: { members: { orderBy: { sortOrder: "asc" } } } });
  if (!fam) notFound();
  const head = fam.members.find((m) => m.isHead) ?? fam.members[0];
  const superAdmin = canReadAudit(user.role);
  const logs = superAdmin
    ? await db.auditLog.findMany({ where: { entity: "family", entityId: String(fam.id) }, orderBy: { at: "desc" }, take: 50 })
    : [];
  const createdLog = superAdmin
    ? await db.auditLog.findFirst({ where: { entity: "family", entityId: String(fam.id), action: { in: ["create", "import"] } }, orderBy: { at: "asc" } })
    : null;

  return (
    <>
      {saved && <p className="alert ok" role="status">{saved === "new" ? t("family_created", { no: fam.familyNo }) : t("family_updated")}</p>}
      <div className="pagehead">
        <div>
          <span className="muted">{fam.familyNo} · {fam.membershipType}</span>
          <h1>{head ? fullName(head) : fam.familyNo} {!fam.isActive && <span className="chip bad">{t("inactive")}</span>}</h1>
        </div>
        <div className="btns">
          <Link className="btn" href="/members">{t("back")}</Link>
          {can(user.role, "members", "edit") && <Link className="btn pri" href={`/members/${fam.id}/edit`}>{t("edit")}</Link>}
        </div>
      </div>

      <section className="card">
        <h2>{t("family_section")}</h2>
        <dl className="kv">
          <dt>{t("mobile")}</dt><dd>{fmtMobile(head?.mobile) || "—"}</dd>
          <dt>{t("vatan")}</dt><dd>{fam.vatan || "—"}</dd>
          <dt>{t("area")}</dt><dd>{fam.area || "—"}</dd>
          <dt>{t("address")}</dt><dd style={{ whiteSpace: "pre-line" }}>{[fam.address, fam.city].filter(Boolean).join(", ") || "—"}</dd>
          {head?.pan && <><dt>PAN</dt><dd>{head.pan}</dd></>}
          {fam.notes && <><dt>{t("notes")}</dt><dd>{fam.notes}</dd></>}
          {superAdmin && <><dt>{t("created_by")}</dt><dd>{fmtDateTime(fam.createdAt)}{createdLog ? ` · ${createdLog.userName}` : ""}</dd></>}
        </dl>
      </section>

      <section className="card">
        <h2>{t("members_section")} ({fam.members.length})</h2>
        <div className="tablewrap">
          <table className="t">
            <thead><tr><th>{t("name")}</th><th>{t("relation")}</th><th>{t("dob")}</th><th>{t("mobile")}</th><th>{t("blood_group")}</th><th>{t("education")}</th><th>{t("occupation")}</th><th>{t("marital_status")}</th></tr></thead>
            <tbody>
              {fam.members.map((m) => (
                <tr key={m.id} className={m.isAlive ? undefined : "dim"}>
                  <td>{fullName(m)} {m.isHead && <span className="chip brand">{t("head_section")}</span>} {!m.isAlive && <span className="chip">{t("deceased")}</span>}</td>
                  <td>{m.relation}</td>
                  <td className="nowrap">{fmtDate(m.dob)}</td>
                  <td className="nowrap">{fmtMobile(m.mobile)}</td>
                  <td>{m.bloodGroup}</td>
                  <td>{m.education}</td>
                  <td>{m.occupation}</td>
                  <td>{m.maritalStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {can(user.role, "members", "cancel") && <ActiveToggle familyId={fam.id} active={fam.isActive} />}

      {superAdmin && logs.length > 0 && (
        <section className="card">
          <h2>{t("history")}</h2>
          <AuditTable rows={logs} t={t} compact />
        </section>
      )}
    </>
  );
}

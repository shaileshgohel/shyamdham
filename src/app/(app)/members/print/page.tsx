import { db } from "@/lib/db";
import { actorOf, requirePage } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { getT } from "@/lib/i18n";
import { familyWhere, parseFilters } from "@/lib/members";
import { fmtDate, fmtMobile, fullName, todayIST } from "@/lib/format";
import { PrintButton } from "./print-button";
import Link from "next/link";

export const metadata = { title: "ડિરેક્ટરી" };

export default async function PrintPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePage("members", "view");
  const t = await getT();
  const f = parseFilters(await searchParams);
  const families = await db.family.findMany({
    where: familyWhere(f),
    orderBy: [{ area: "asc" }, { familyNo: "asc" }],
    include: { members: { orderBy: { sortOrder: "asc" } } },
    take: 5000,
  });
  await audit(actorOf(user), { action: "export", entity: "family", summary: `છાપવા માટે ડિરેક્ટરી ખોલી: ${families.length} પરિવાર` });
  const [y, m, d] = todayIST().split("-");
  return (
    <>
      <div className="pagehead no-print">
        <div><h1>{t("print_directory")}</h1><p className="muted small">{families.length} {t.lang === "en" ? "families" : "પરિવાર"}</p></div>
        <div className="btns"><Link className="btn" href="/members">{t("back")}</Link><PrintButton label={t.lang === "en" ? "Print / Save as PDF" : "છાપો / PDF સેવ કરો"} /></div>
      </div>
      <div className="print-only" style={{ textAlign: "center", marginBottom: 12 }}>
        <h1>{t("app_name")} · {t("dir_title")}</h1>
        <p>{t("app_sub")} · {d}/{m}/{y}</p>
      </div>
      <div className="tablewrap">
        <table className="t">
          <thead><tr><th>{t("family_no")}</th><th>{t("name")}</th><th>{t("relation")}</th><th>{t("dob")}</th><th>{t("mobile")}</th><th>{t("blood_group")}</th><th>{t("occupation")}</th><th>{t("area")} / {t("address")}</th></tr></thead>
          <tbody>
            {families.flatMap((fam) =>
              fam.members.map((mem, i) => (
                <tr key={mem.id} style={i === 0 ? { borderTop: "2px solid var(--line)" } : undefined}>
                  <td className="nowrap">{i === 0 ? fam.familyNo : ""}</td>
                  <td style={i === 0 ? { fontWeight: 600 } : undefined}>{fullName(mem)}{!mem.isAlive ? " (સ્વ.)" : ""}</td>
                  <td>{mem.relation}</td>
                  <td className="nowrap">{fmtDate(mem.dob)}</td>
                  <td className="nowrap">{fmtMobile(mem.mobile)}</td>
                  <td>{mem.bloodGroup}</td>
                  <td>{mem.occupation}</td>
                  <td>{i === 0 ? [fam.area, fam.address].filter(Boolean).join(" · ") : ""}</td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { isoDate } from "@/lib/format";
import { masterLists } from "@/lib/members";
import { FamilyForm } from "../../family-form";
import { FORM_OPTS } from "../../form-options";

export const metadata = { title: "પરિવાર સુધારો" };

export default async function EditFamilyPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePage("members", "edit");
  const t = await getT();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const fam = await db.family.findUnique({ where: { id }, include: { members: { orderBy: { sortOrder: "asc" } } } });
  if (!fam) notFound();
  const lists = await masterLists();
  const s = (x: string | null) => x ?? "";
  return (
    <>
      <div className="pagehead"><div><h1>{t("family_edit_title")}</h1><p className="muted">{fam.familyNo}</p></div></div>
      <FamilyForm
        cancelHref={`/members/${fam.id}`}
        lists={lists}
        opts={FORM_OPTS}
        initial={{
          id: fam.id,
          address: s(fam.address), area: s(fam.area), vatan: s(fam.vatan), city: s(fam.city),
          membershipType: fam.membershipType, notes: s(fam.notes),
          headIndex: Math.max(0, fam.members.findIndex((m) => m.isHead)),
          members: fam.members.map((m) => ({
            id: m.id, key: `m${m.id}`, firstName: m.firstName, fatherName: s(m.fatherName), surname: m.surname,
            relation: m.relation, gender: s(m.gender), dob: isoDate(m.dob), mobile: s(m.mobile), email: s(m.email),
            bloodGroup: s(m.bloodGroup), education: s(m.education), occupation: s(m.occupation),
            maritalStatus: s(m.maritalStatus), pan: s(m.pan), isAlive: m.isAlive,
          })),
        }}
      />
    </>
  );
}

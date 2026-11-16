import { requirePage } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { masterLists } from "@/lib/members";
import { FamilyForm } from "../family-form";
import { emptyMember } from "../member-row";
import { FORM_OPTS } from "../form-options";

export const metadata = { title: "નવો પરિવાર" };

export default async function NewFamilyPage() {
  await requirePage("members", "create");
  const t = await getT();
  const lists = await masterLists();
  return (
    <>
      <div className="pagehead"><div><h1>{t("family_new_title")}</h1><p className="muted small">{t.lang === "en" ? "Member no. is assigned on save." : "સભ્ય નંબર સેવ કરતી વખતે આપોઆપ મળશે."}</p></div></div>
      <FamilyForm
        cancelHref="/members"
        lists={lists}
        opts={FORM_OPTS}
        initial={{ address: "", area: "", vatan: "", city: "જુનાગઢ", membershipType: "સામાન્ય", notes: "", headIndex: 0, members: [emptyMember()] }}
      />
    </>
  );
}

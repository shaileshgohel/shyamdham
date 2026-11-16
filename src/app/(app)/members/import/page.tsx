import Link from "next/link";
import { requirePage } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { ImportClient } from "./import-client";

export const metadata = { title: "આયાત" };

export default async function ImportPage() {
  await requirePage("members", "create");
  const t = await getT();
  return (
    <>
      <div className="pagehead">
        <div><h1>{t("import_title")}</h1></div>
        <Link className="btn" href="/members">{t("back")}</Link>
      </div>
      <ImportClient />
    </>
  );
}

import { requirePage } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { ITEM_CATEGORIES } from "@/lib/inventory";
import { ItemForm } from "../forms";

export const metadata = { title: "નવી વસ્તુ" };

export default async function NewItemPage() {
  await requirePage("inventory", "create");
  const t = await getT();
  return (
    <>
      <div className="pagehead"><div><h1>{t.g("નવી વસ્તુ", "New item")}</h1></div></div>
      <ItemForm categories={ITEM_CATEGORIES} v={{ nameGu: "", category: ITEM_CATEGORIES[0], location: "", unit: "નંગ", minQty: 0, chargeRate: 0, notes: "", isActive: true }} />
    </>
  );
}

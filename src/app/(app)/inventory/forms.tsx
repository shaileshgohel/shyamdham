"use client";
import { ActionForm, Submit } from "@/components/action-form";
import { useG } from "@/components/i18n-client";
import { issueItemsAction, returnItemsAction, saveItemAction, stockMovementAction } from "./actions";

type ItemVal = { id?: number; nameGu: string; category: string; location: string; unit: string; minQty: number; chargeRate: number; notes: string; isActive: boolean };

export function ItemForm({ v, categories }: { v: ItemVal; categories: string[] }) {
  const g = useG();
  return (
    <ActionForm action={saveItemAction} className="card form">
      {(_s, pending) => (
        <>
          {v.id && <input type="hidden" name="id" value={v.id} />}
          <datalist id="dl-cat">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          <div className="fields">
            <div className="field"><label htmlFor="nameGu">{g("વસ્તુનું નામ", "Item name")} <span className="req">*</span></label><input id="nameGu" name="nameGu" type="text" defaultValue={v.nameGu} required /></div>
            <div className="field"><label htmlFor="category">{g("કેટેગરી", "Category")}</label><input id="category" name="category" type="text" list="dl-cat" defaultValue={v.category} /></div>
            <div className="field"><label htmlFor="location">{g("ક્યાં રાખેલ છે", "Kept at")}</label><input id="location" name="location" type="text" defaultValue={v.location} /></div>
            <div className="field"><label htmlFor="unit">{g("એકમ", "Unit")}</label><input id="unit" name="unit" type="text" defaultValue={v.unit} /></div>
            {!v.id && <div className="field"><label htmlFor="openingQty">{g("હાલનો જથ્થો", "Quantity now")}</label><input id="openingQty" name="openingQty" type="text" inputMode="numeric" defaultValue="0" /></div>}
            <div className="field"><label htmlFor="minQty">{g("ઓછામાં ઓછો જથ્થો (ચેતવણી માટે)", "Minimum quantity (for warning)")}</label><input id="minQty" name="minQty" type="text" inputMode="numeric" defaultValue={String(v.minQty)} /></div>
            <div className="field"><label htmlFor="chargeRate">{g("નુકસાન / ખૂટે તો ચાર્જ ₹ પ્રતિ નંગ", "Charge ₹ per piece if lost or damaged")}</label><input id="chargeRate" name="chargeRate" type="text" inputMode="decimal" defaultValue={String(v.chargeRate)} /></div>
            {v.id && <div className="field"><label htmlFor="isActive">{g("સ્થિતિ", "Status")}</label><select id="isActive" name="isActive" defaultValue={v.isActive ? "1" : "0"}><option value="1">{g("ચાલુ", "Active")}</option><option value="0">{g("બંધ", "Off")}</option></select></div>}
            <div className="field wide"><label htmlFor="notes">{g("નોંધ", "Notes")}</label><input id="notes" name="notes" type="text" defaultValue={v.notes} /></div>
          </div>
          <div className="btns"><Submit pending={pending}>{g("સેવ કરો", "Save")}</Submit></div>
        </>
      )}
    </ActionForm>
  );
}

export function MovementForm({ itemId, unit, available, damaged }: { itemId: number; unit: string; available: number; damaged: number }) {
  const g = useG();
  return (
    <ActionForm action={stockMovementAction} className="card form" resetOnSuccess>
      {(_s, pending) => (
        <>
          <h2>{g("સ્ટોકમાં ફેરફાર", "Change stock")}</h2>
          <input type="hidden" name="itemId" value={itemId} />
          <div className="fields">
            <div className="field"><label htmlFor="mtype">{g("શું થયું", "What happened")}</label>
              <select id="mtype" name="type">
                <option value="PURCHASE">{g("નવી ખરીદી / ભેટ (+)", "New purchase / gift (+)")}</option>
                <option value="COUNT">{g("ગણતરી: સ્ટોરમાં ખરેખર કેટલા છે", "Count: how many are really in the store")}</option>
                <option value="DAMAGED">{g(`સ્ટોરમાં નુકસાન થયું (ઉપલબ્ધ ${available})`, `Damaged in store (available ${available})`)}</option>
                <option value="REPAIRED">{g(`રિપેર થઈ પાછું વાપરવા લાયક (નુકસાન ${damaged})`, `Repaired, usable again (damaged ${damaged})`)}</option>
                <option value="WRITE_OFF">{g(`કાયમ માટે કાઢી નાખો (નુકસાન ${damaged})`, `Write off for good (damaged ${damaged})`)}</option>
              </select>
            </div>
            <div className="field"><label htmlFor="mqty">{g(`જથ્થો (${unit})`, `Quantity (${unit})`)}</label><input id="mqty" name="qty" type="text" inputMode="numeric" required /></div>
            <div className="field wide"><label htmlFor="mnotes">{g("નોંધ / કારણ (ગણતરી અને કાઢી નાખવા માટે જરૂરી)", "Note / reason (required for count and write-off)")}</label><input id="mnotes" name="notes" type="text" /></div>
          </div>
          <div className="btns"><Submit pending={pending} className="btn">{g("નોંધો", "Record")}</Submit></div>
        </>
      )}
    </ActionForm>
  );
}

export function IssueForm({ bookingId, items }: { bookingId: number; items: { id: number; name: string; unit: string; available: number }[] }) {
  const g = useG();
  return (
    <ActionForm action={issueItemsAction} className="card form" resetOnSuccess>
      {(_s, pending) => (
        <>
          <h2>{g("વસ્તુ આપો", "Issue items")}</h2>
          <input type="hidden" name="bookingId" value={bookingId} />
          <div className="tablewrap">
            <table className="t">
              <thead><tr><th>{g("વસ્તુ", "Item")}</th><th className="num">{g("ઉપલબ્ધ", "Available")}</th><th className="num">{g("આપો", "Issue")}</th></tr></thead>
              <tbody>{items.map((i) => <tr key={i.id}><td>{i.name}</td><td className="num">{i.available} {i.unit}</td><td className="num"><input name={`issue.${i.id}`} type="text" inputMode="numeric" aria-label={`${i.name} ${g("આપો", "issue")}`} placeholder="0" style={{ width: 80, textAlign: "right" }} /></td></tr>)}</tbody>
            </table>
          </div>
          <div className="btns"><Submit pending={pending}>{g("આપ્યાની નોંધ કરો", "Record issue")}</Submit></div>
        </>
      )}
    </ActionForm>
  );
}

export function ReturnForm({ bookingId, items }: { bookingId: number; items: { id: number; name: string; unit: string; out: number; rate: number }[] }) {
  const g = useG();
  return (
    <ActionForm action={returnItemsAction} className="card form">
      {(_s, pending) => (
        <>
          <h2>{g("વસ્તુ પરત લો", "Take items back")}</h2>
          <input type="hidden" name="bookingId" value={bookingId} />
          <div className="tablewrap">
            <table className="t">
              <thead><tr><th>{g("વસ્તુ", "Item")}</th><th className="num">{g("બહાર", "Out")}</th><th className="num">{g("સારી પરત", "Back good")}</th><th className="num">{g("નુકસાન", "Damaged")}</th><th className="num">{g("ખૂટે છે", "Missing")}</th><th className="num">{g("ચાર્જ/નંગ", "Charge/pc")}</th></tr></thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id}>
                    <td>{i.name}</td><td className="num">{i.out}</td>
                    <td className="num"><input name={`good.${i.id}`} type="text" inputMode="numeric" defaultValue={String(i.out)} aria-label={`${i.name} ${g("સારી પરત", "good")}`} style={{ width: 70, textAlign: "right" }} /></td>
                    <td className="num"><input name={`damaged.${i.id}`} type="text" inputMode="numeric" placeholder="0" aria-label={`${i.name} ${g("નુકસાન", "damaged")}`} style={{ width: 70, textAlign: "right" }} /></td>
                    <td className="num"><input name={`missing.${i.id}`} type="text" inputMode="numeric" placeholder="0" aria-label={`${i.name} ${g("ખૂટે છે", "missing")}`} style={{ width: 70, textAlign: "right" }} /></td>
                    <td className="num">₹ {i.rate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <label className="check"><input type="checkbox" name="charge" defaultChecked /> {g("નુકસાન અને ખૂટતી વસ્તુનો ચાર્જ બિલમાં ઉમેરો", "Add charges for damaged and missing items to the bill")}</label>
          <div className="btns"><Submit pending={pending}>{g("પરત નોંધો", "Record return")}</Submit></div>
        </>
      )}
    </ActionForm>
  );
}

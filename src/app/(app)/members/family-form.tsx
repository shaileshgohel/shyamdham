"use client";
import { startTransition, useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useT } from "@/components/i18n-client";
import { saveFamilyAction, type SaveFamilyState } from "./actions";
import type { DictKey } from "@/lib/i18n-dict";
import { emptyMember, type MemberRow } from "./member-row";

export type FamilyFormValue = {
  id?: number | null;
  address: string;
  area: string;
  vatan: string;
  city: string;
  membershipType: string;
  notes: string;
  headIndex: number;
  members: MemberRow[];
};

type Lists = Record<string, string[]>;
type Opts = { relations: string[]; marital: string[]; membership: string[]; bloodGroups: string[] };

export function FamilyForm({ initial, lists, opts, cancelHref }: { initial: FamilyFormValue; lists: Lists; opts: Opts; cancelHref: string }) {
  const t = useT();
  const router = useRouter();
  const [v, setV] = useState<FamilyFormValue>(initial);
  const [state, action, pending] = useActionState<SaveFamilyState, FormData>(saveFamilyAction, {});
  const fe = state.fieldErrors ?? {};

  useEffect(() => {
    if (state.ok && state.familyId) router.push(`/members/${state.familyId}?saved=${initial.id ? "edit" : "new"}`);
  }, [state, router, initial.id]);

  const setF = (k: keyof FamilyFormValue, val: string) => setV((p) => ({ ...p, [k]: val }));
  const setM = (i: number, k: keyof MemberRow, val: string | boolean) =>
    setV((p) => ({ ...p, members: p.members.map((m, j) => (j === i ? { ...m, [k]: val } : m)) }));
  const addMember = () => setV((p) => ({ ...p, members: [...p.members, emptyMember(p.members[p.headIndex]?.surname ?? "", "")] }));
  const removeMember = (i: number) =>
    setV((p) => {
      const members = p.members.filter((_, j) => j !== i);
      const headIndex = i === p.headIndex ? 0 : i < p.headIndex ? p.headIndex - 1 : p.headIndex;
      return { ...p, members, headIndex };
    });

  const payload = JSON.stringify({
    ...v,
    members: v.members.map(({ key: _k, ...m }) => ({ ...m, gender: m.gender || null })),
  });

  const err = (path: string) => fe[path] as DictKey | undefined;
  const cls = (path: string) => (err(path) ? "bad" : undefined);

  const datalist = (id: string, values: string[]) => (
    <datalist id={id}>{values.map((x) => <option key={x} value={x} />)}</datalist>
  );

  return (
    // Submitted by hand rather than via <form action>, because React resets a form after an
    // action runs and that would blank the drop-downs on the screen when the server reports an error.
    <form
      className="form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
    >
      <input type="hidden" name="payload" value={payload} />
      {datalist("dl-vatan", lists.VATAN ?? [])}
      {datalist("dl-area", lists.AREA ?? [])}
      {datalist("dl-occ", lists.OCCUPATION ?? [])}
      {datalist("dl-edu", lists.EDUCATION ?? [])}

      {state.error && <p className="alert bad" role="alert">{t(state.error, state.errorVars)}</p>}

      <section className="card">
        <h2>{t("family_section")}</h2>
        <div className="fields">
          <div className="field">
            <label htmlFor="vatan">{t("vatan")}</label>
            <input id="vatan" type="text" list="dl-vatan" value={v.vatan} onChange={(e) => setF("vatan", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="area">{t("area")}</label>
            <input id="area" type="text" list="dl-area" value={v.area} onChange={(e) => setF("area", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="city">{t("city")}</label>
            <input id="city" type="text" value={v.city} onChange={(e) => setF("city", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="membershipType">{t("membership")}</label>
            <select id="membershipType" value={v.membershipType} onChange={(e) => setF("membershipType", e.target.value)}>
              {opts.membership.map((x) => <option key={x}>{x}</option>)}
            </select>
          </div>
          <div className="field wide">
            <label htmlFor="address">{t("address")}</label>
            <textarea id="address" value={v.address} onChange={(e) => setF("address", e.target.value)} />
          </div>
          <div className="field wide">
            <label htmlFor="notes">{t("notes")}</label>
            <input id="notes" type="text" value={v.notes} onChange={(e) => setF("notes", e.target.value)} />
          </div>
        </div>
      </section>

      <section className="card">
        <div className="pagehead">
          <h2>{t("members_section")}</h2>
          <button type="button" className="btn" onClick={addMember}>{t("add_member")}</button>
        </div>
        {v.members.map((m, i) => {
          const p = `members.${i}`;
          const isHead = i === v.headIndex;
          return (
            <div key={m.key} className="memrow" data-testid={`member-${i}`}>
              <div className="memrow-head">
                <label className="check">
                  <input type="radio" name="head" checked={isHead} onChange={() => setV((x) => ({ ...x, headIndex: i }))} />
                  <b>{isHead ? t("head_section") : `${i + 1}.`}</b>
                </label>
                {v.members.length > 1 && (
                  <button type="button" className="btn sm danger" onClick={() => removeMember(i)}>{t("remove")}</button>
                )}
              </div>
              <div className="fields">
                <Field id={`${p}.firstName`} label={t("first_name")} req error={err(`${p}.firstName`)} t={t}>
                  <input id={`${p}.firstName`} type="text" className={cls(`${p}.firstName`)} value={m.firstName} onChange={(e) => setM(i, "firstName", e.target.value)} />
                </Field>
                <Field id={`${p}.fatherName`} label={t("father_name")} t={t}>
                  <input id={`${p}.fatherName`} type="text" value={m.fatherName} onChange={(e) => setM(i, "fatherName", e.target.value)} />
                </Field>
                <Field id={`${p}.surname`} label={t("surname")} req error={err(`${p}.surname`)} t={t}>
                  <input id={`${p}.surname`} type="text" className={cls(`${p}.surname`)} value={m.surname} onChange={(e) => setM(i, "surname", e.target.value)} />
                </Field>
                <Field id={`${p}.relation`} label={t("relation")} req error={err(`${p}.relation`)} t={t}>
                  <select id={`${p}.relation`} className={cls(`${p}.relation`)} value={m.relation} onChange={(e) => setM(i, "relation", e.target.value)}>
                    <option value="">{t("choose")}</option>
                    {opts.relations.map((x) => <option key={x}>{x}</option>)}
                  </select>
                </Field>
                <Field id={`${p}.gender`} label={t("gender")} t={t}>
                  <select id={`${p}.gender`} value={m.gender} onChange={(e) => setM(i, "gender", e.target.value)}>
                    <option value="">{t("choose")}</option>
                    <option value="M">{t("male")}</option>
                    <option value="F">{t("female")}</option>
                  </select>
                </Field>
                <Field id={`${p}.dob`} label={t("dob")} error={err(`${p}.dob`)} t={t}>
                  <input id={`${p}.dob`} type="date" className={cls(`${p}.dob`)} value={m.dob} onChange={(e) => setM(i, "dob", e.target.value)} />
                </Field>
                <Field id={`${p}.mobile`} label={t("mobile")} error={err(`${p}.mobile`)} t={t}>
                  <input id={`${p}.mobile`} type="tel" inputMode="numeric" className={cls(`${p}.mobile`)} value={m.mobile} onChange={(e) => setM(i, "mobile", e.target.value)} />
                </Field>
                <Field id={`${p}.bloodGroup`} label={t("blood_group")} t={t}>
                  <select id={`${p}.bloodGroup`} value={m.bloodGroup} onChange={(e) => setM(i, "bloodGroup", e.target.value)}>
                    <option value="">{t("choose")}</option>
                    {opts.bloodGroups.map((x) => <option key={x}>{x}</option>)}
                  </select>
                </Field>
                <Field id={`${p}.education`} label={t("education")} t={t}>
                  <input id={`${p}.education`} type="text" list="dl-edu" value={m.education} onChange={(e) => setM(i, "education", e.target.value)} />
                </Field>
                <Field id={`${p}.occupation`} label={t("occupation")} t={t}>
                  <input id={`${p}.occupation`} type="text" list="dl-occ" value={m.occupation} onChange={(e) => setM(i, "occupation", e.target.value)} />
                </Field>
                <Field id={`${p}.maritalStatus`} label={t("marital_status")} t={t}>
                  <select id={`${p}.maritalStatus`} value={m.maritalStatus} onChange={(e) => setM(i, "maritalStatus", e.target.value)}>
                    <option value="">{t("choose")}</option>
                    {opts.marital.map((x) => <option key={x}>{x}</option>)}
                  </select>
                </Field>
                <Field id={`${p}.email`} label={t("email")} error={err(`${p}.email`)} t={t}>
                  <input id={`${p}.email`} type="email" className={cls(`${p}.email`)} value={m.email} onChange={(e) => setM(i, "email", e.target.value)} />
                </Field>
                {isHead && (
                  <Field id={`${p}.pan`} label={t("pan")} error={err(`${p}.pan`)} t={t}>
                    <input id={`${p}.pan`} type="text" className={cls(`${p}.pan`)} value={m.pan} onChange={(e) => setM(i, "pan", e.target.value.toUpperCase())} />
                  </Field>
                )}
                <div className="field">
                  <label>&nbsp;</label>
                  <label className="check">
                    <input type="checkbox" checked={!m.isAlive} onChange={(e) => setM(i, "isAlive", !e.target.checked)} />
                    {t("deceased")}
                  </label>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      <div className="btns">
        <button type="submit" className="btn pri" disabled={pending}>{pending ? "…" : t("save")}</button>
        <Link href={cancelHref} className="btn">{t("cancel")}</Link>
      </div>
    </form>
  );
}

function Field({ id, label, req, error, children, t }: { id: string; label: string; req?: boolean; error?: DictKey; children: React.ReactNode; t: ReturnType<typeof useT> }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}{req && <span className="req"> *</span>}</label>
      {children}
      {error && <span className="err">{t(error)}</span>}
    </div>
  );
}

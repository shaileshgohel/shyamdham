"use client";
import { useEffect, useRef, useState } from "react";
import { useG } from "./i18n-client";

export type PickedMember = { familyId: number; familyNo: string; name: string; mobile: string | null; address: string | null; pan: string | null };

/** Type a name, surname, mobile or member no. and pick a family head; or just type any name. */
export function MemberPicker({ nameField, label, onPick, defaultName = "", defaultFamilyId }: { nameField: string; label: string; onPick: (m: PickedMember | null) => void; defaultName?: string; defaultFamilyId?: number | null }) {
  const g = useG();
  const [q, setQ] = useState(defaultName);
  const [res, setRes] = useState<PickedMember[]>([]);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<number | null>(defaultFamilyId ?? null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2 || picked) { setRes([]); return; }
    timer.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/member-search?q=${encodeURIComponent(q.trim())}`);
        if (r.ok) { setRes(await r.json()); setOpen(true); }
      } catch { /* offline: the field still works as plain text */ }
    }, 250);
  }, [q, picked]);

  return (
    <div className="field" style={{ position: "relative" }}>
      <label htmlFor={nameField}>{label} <span className="req">*</span></label>
      <input
        id={nameField} name={nameField} type="text" autoComplete="off" value={q} required
        onChange={(e) => { setQ(e.target.value); if (picked) { setPicked(null); onPick(null); } }}
        onFocus={() => res.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      <input type="hidden" name="familyId" value={picked ?? ""} />
      {picked ? <span className="help">✓ {g("સભ્ય સાથે જોડાયેલ", "Linked to member")}</span> : <span className="help">{g("સભ્ય શોધવા નામ કે મોબાઈલ લખો, અથવા કોઈ પણ નામ લખો", "Type a name or mobile to find a member, or type any name")}</span>}
      {open && res.length > 0 && (
        <ul className="picker" role="listbox">
          {res.map((m) => (
            <li key={m.familyId}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { setQ(m.name); setPicked(m.familyId); setOpen(false); onPick(m); }}>
                <b>{m.name}</b> <span className="muted small">{m.familyNo}{m.mobile ? ` · ${m.mobile}` : ""}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

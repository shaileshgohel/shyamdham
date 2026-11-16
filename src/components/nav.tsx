"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export type NavItem = { href: string; label: string; soon?: string; group?: string };

export function Shell({ items, foot, title, children }: { items: NavItem[]; foot: React.ReactNode; title: string; children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  return (
    <div className={`shell${open ? " open" : ""}`}>
      <aside className="side" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
        <div className="brand"><b>{title}</b></div>
        {items.map((it) =>
          it.group ? (
            <div key={it.group} className="navgroup">{it.group}</div>
          ) : it.soon ? (
            <span key={it.href} className="navlink off" aria-disabled="true">
              {it.label} <span className="soon">{it.soon}</span>
            </span>
          ) : (
            <Link key={it.href} href={it.href} className={`navlink${path === it.href || path.startsWith(it.href + "/") ? " on" : ""}`}>
              {it.label}
            </Link>
          ),
        )}
        <div className="side-foot">{foot}</div>
      </aside>
      <div style={{ minWidth: 0 }}>
        <div className="topbar">
          <button className="btn sm" onClick={() => setOpen(true)} aria-label="Menu">☰</button>
          <b>{title}</b>
        </div>
        <main className="main">{children}</main>
      </div>
    </div>
  );
}

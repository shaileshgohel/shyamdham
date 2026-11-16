"use client";
import { useEffect } from "react";

export function PrintBar({ back, printLabel, backLabel, auto }: { back: string; printLabel: string; backLabel: string; auto?: boolean }) {
  useEffect(() => { if (auto) setTimeout(() => window.print(), 400); }, [auto]);
  return (
    <div className="print-bar">
      <a className="btn" href={back}>{backLabel}</a>
      <button className="btn pri" onClick={() => window.print()}>{printLabel}</button>
    </div>
  );
}

"use client";
import { useState } from "react";

/** A danger button that reveals its confirmation form only when clicked. */
export function CancelToggle({ label, children, className = "btn danger" }: { label: string; children: React.ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  return open ? <>{children}</> : <div><button type="button" className={className} onClick={() => setOpen(true)}>{label}</button></div>;
}

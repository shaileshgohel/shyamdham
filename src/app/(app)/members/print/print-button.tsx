"use client";
export function PrintButton({ label }: { label: string }) {
  return <button className="btn pri" onClick={() => window.print()}>{label}</button>;
}

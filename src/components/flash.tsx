"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

// A page-level confirmation ("Payment recorded") that survives the server refresh after an action,
// even when the form that triggered it is no longer on the page.
const FlashContext = createContext<((msg: string) => void) | null>(null);

export function FlashProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState<{ text: string; n: number } | null>(null);
  const flash = useCallback((text: string) => setMsg((m) => ({ text, n: (m?.n ?? 0) + 1 })), []);
  useEffect(() => {
    if (!msg) return;
    const id = setTimeout(() => setMsg(null), 6000);
    return () => clearTimeout(id);
  }, [msg]);
  return (
    <FlashContext.Provider value={flash}>
      {msg && <p key={msg.n} className="alert ok flash" role="status">{msg.text}</p>}
      {children}
    </FlashContext.Provider>
  );
}

export function useFlash() {
  return useContext(FlashContext);
}

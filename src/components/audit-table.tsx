import type { AuditLog } from "@prisma/client";
import { fmtDateTime } from "@/lib/format";
import { isDictKey } from "@/lib/i18n-dict";
import type { T } from "@/lib/i18n";

const actionTone: Record<string, string> = { create: "ok", login: "", cancel: "bad", login_failed: "bad", restore: "ok", edit: "brand", import: "gold", export: "gold" };

export function AuditTable({ rows, t, compact }: { rows: AuditLog[]; t: T; compact?: boolean }) {
  const label = (prefix: string, k: string) => {
    const key = `${prefix}_${k}`;
    return isDictKey(key) ? t(key) : k;
  };
  return (
    <div className="tablewrap">
      <table className="t">
        <thead>
          <tr>
            <th>{t("time")}</th><th>{t("user")}</th><th>{t("action")}</th>
            {!compact && <th>{t("type")}</th>}
            <th>{t("document")}</th><th>{t("details")}</th><th>{t("device")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const changes = (r.changes ?? null) as Record<string, [unknown, unknown]> | null;
            return (
              <tr key={String(r.id)}>
                <td className="nowrap">{fmtDateTime(r.at)}</td>
                <td>{r.userName}</td>
                <td><span className={`chip ${actionTone[r.action] ?? ""}`}>{label("act", r.action)}</span></td>
                {!compact && <td>{label("ent", r.entity)}</td>}
                <td className="nowrap">{r.docNo ?? "—"}</td>
                <td>
                  {r.summary}
                  {changes && Object.keys(changes).length > 0 && (
                    <details className="changes">
                      <summary>{Object.keys(changes).length} {t.lang === "en" ? "changes" : "ફેરફાર"}</summary>
                      <table className="t">
                        <tbody>
                          {Object.entries(changes).map(([k, [a, b]]) => (
                            <tr key={k}><td>{k}</td><td>{show(a)}</td><td>→</td><td>{show(b)}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </details>
                  )}
                </td>
                <td className="small muted">{r.device ?? ""}{r.ip ? <><br />{r.ip}</> : null}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function show(v: unknown) {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "✓" : "✗";
  return String(v);
}

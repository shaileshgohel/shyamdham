import Link from "next/link";
import { inr } from "@/lib/money";
import { filterQs } from "@/lib/donation-query";
import type { HeadRow } from "@/lib/reports";

type Row = { m: string; label: string; income: number; expense: number; from: string; to: string };
type Breakdown = { income: HeadRow[]; expense: HeadRow[]; totalIncome: number; totalExpense: number; from: string; to: string; label: string };
type Labels = Record<"title" | "income" | "expense" | "hint" | "allMonths" | "allVouchers" | "entries" | "surplus" | "deficit" | "none" | "headHint", string>;

/**
 * Monthly income / expense chart with two drill-down levels, all plain links so it works without JS:
 *   month row  → ?m=YYYY-MM re-renders the dashboard with that month's head-wise breakdown beside the chart
 *   amount     → voucher list filtered to that month and type
 *   head bar   → voucher list filtered to that month and head
 */
export function MonthChart({ rows, selected, breakdown, lang, labels: L }: { rows: Row[]; selected?: string; breakdown: Breakdown | null; lang: string; labels: Labels }) {
  const maxBar = Math.max(1, ...rows.flatMap((r) => [r.income, r.expense]));
  const vouchers = (f: Record<string, unknown>) => `/accounts/vouchers?${filterQs(f)}`;
  const headName = (h: HeadRow) => (lang === "en" ? h.nameEn ?? h.nameGu : h.nameGu);
  return (
    <>
      <section className="card">
        <h2>{L.title}</h2>
        <div className="hbars drill" role="list">
          {rows.map((r) => (
            <div key={r.m} role="listitem" className={`drill-row${r.m === selected ? " sel" : ""}`}>
              <Link href={r.m === selected ? "/dashboard" : `/dashboard?m=${r.m}#month-${r.m}`} className="drill-label" aria-current={r.m === selected ? "true" : undefined} scroll={false}>{r.label}</Link>
              <span className="drill-bars">
                <Link href={vouchers({ from: r.from, to: r.to, type: "INCOME" })} className="drill-bar" title={`${L.income} · ${r.label}`}><i style={{ width: `${(r.income / maxBar) * 100}%`, minWidth: r.income ? 2 : 0, background: "var(--brand)" }} /><span className="small">{inr(r.income)}</span></Link>
                <Link href={vouchers({ from: r.from, to: r.to, type: "EXPENSE" })} className="drill-bar" title={`${L.expense} · ${r.label}`}><i style={{ width: `${(r.expense / maxBar) * 100}%`, minWidth: r.expense ? 2 : 0, background: "var(--gold)" }} /><span className="small muted">{inr(r.expense)}</span></Link>
              </span>
            </div>
          ))}
        </div>
        <span className="small muted"><span style={{ color: "var(--brand)" }}>■</span> {L.income} &nbsp; <span style={{ color: "var(--gold)" }}>■</span> {L.expense} &nbsp;·&nbsp; {L.hint}</span>
      </section>

      {breakdown && (
        <section className="card drill-detail" id={`month-${selected}`}>
          <div className="pagehead">
            <h2>{breakdown.label}</h2>
            <Link className="small" href="/dashboard" scroll={false}>{L.allMonths}</Link>
          </div>
          {breakdown.income.length + breakdown.expense.length === 0 ? (
            <p className="muted small">{L.none}</p>
          ) : (
            <>
              <HeadBars title={L.income} rows={breakdown.income} total={breakdown.totalIncome} color="var(--brand)" href={(h) => vouchers({ from: breakdown.from, to: breakdown.to, head: h.headId })} name={headName} entries={L.entries} />
              <HeadBars title={L.expense} rows={breakdown.expense} total={breakdown.totalExpense} color="var(--gold)" href={(h) => vouchers({ from: breakdown.from, to: breakdown.to, head: h.headId })} name={headName} entries={L.entries} />
              <div className="drill-foot">
                <span>{breakdown.totalIncome >= breakdown.totalExpense ? L.surplus : L.deficit}: <b className={breakdown.totalIncome >= breakdown.totalExpense ? "pos" : "neg"}>{inr(Math.abs(breakdown.totalIncome - breakdown.totalExpense))}</b></span>
                <Link className="small" href={vouchers({ from: breakdown.from, to: breakdown.to })}>{L.allVouchers}</Link>
              </div>
              <span className="small muted">{L.headHint}</span>
            </>
          )}
        </section>
      )}
    </>
  );
}

function HeadBars({ title, rows, total, color, href, name, entries }: { title: string; rows: HeadRow[]; total: number; color: string; href: (h: HeadRow) => string; name: (h: HeadRow) => string; entries: string }) {
  if (!rows.length) return null;
  const max = Math.max(1, ...rows.map((r) => r.total));
  return (
    <div className="hbars">
      <div className="drill-head"><b>{title}</b><b className="num">{inr(total)}</b></div>
      {[...rows].sort((a, b) => b.total - a.total).map((h) => (
        <Link key={h.headId} href={href(h)} className="drill-row drill-link" title={`${name(h)} · ${h.count} ${entries}`}>
          <span className="drill-label">{name(h)}</span>
          <span className="drill-bars"><span className="drill-bar"><i style={{ width: `${(h.total / max) * 100}%`, minWidth: 2, background: color }} /><span className="small">{inr(h.total)} <span className="muted">· {h.count}</span></span></span></span>
        </Link>
      ))}
    </div>
  );
}

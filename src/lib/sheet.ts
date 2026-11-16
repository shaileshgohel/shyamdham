import "server-only";
import ExcelJS from "exceljs";

export type Col = { header: string; key: string; width?: number; money?: boolean };

/** A one-sheet workbook with a bold frozen header and money columns formatted as Indian rupees. */
export async function simpleWorkbook(title: string, cols: Col[], rows: Record<string, unknown>[], extra?: { titleLines?: string[]; totals?: Record<string, unknown> }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Shyamdham portal";
  const ws = wb.addWorksheet(title.slice(0, 30).replace(/[\\/?*[\]:]/g, "-"));
  let start = 1;
  for (const line of extra?.titleLines ?? []) {
    ws.getCell(start, 1).value = line;
    ws.getCell(start, 1).font = { bold: start === 1, size: start === 1 ? 13 : 11 };
    start++;
  }
  if (start > 1) start++;
  const headerRow = ws.getRow(start);
  cols.forEach((c, i) => {
    headerRow.getCell(i + 1).value = c.header;
    ws.getColumn(i + 1).width = c.width ?? 16;
    if (c.money) ws.getColumn(i + 1).numFmt = "[>=10000000]##\\,##\\,##\\,##0.00;[>=100000]##\\,##\\,##0.00;##,##0.00";
  });
  headerRow.font = { bold: true };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE4EAFA" } };
  ws.views = [{ state: "frozen", ySplit: start }];
  for (const r of rows) ws.addRow(cols.map((c) => r[c.key] ?? null));
  if (extra?.totals) {
    const tr = ws.addRow(cols.map((c) => extra.totals![c.key] ?? null));
    tr.font = { bold: true };
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export function xlsxResponse(buf: Buffer, filename: string) {
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

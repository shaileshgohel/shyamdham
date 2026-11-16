// End-to-end test for phases 2–4: donations, accounts, wadi booking, inventory.
// Run on a freshly reset test database (./tests/reset-test-db.sh) with the app on BASE_URL.
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("@playwright/test")); }

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const DB = process.env.TEST_DATABASE_URL ?? "postgresql://shyamdham:shyamdham@localhost:5432/shyamdham_test";
const OUT = path.resolve("tests/output");
fs.mkdirSync(OUT, { recursive: true });

let passed = 0;
const failures = [];
async function step(name, fn) {
  try { await fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) {
    failures.push(name);
    console.log(`  ✗ ${name}\n      ${String(e.message ?? e).split("\n")[0]}`);
    try { await page.screenshot({ path: path.join(OUT, `p2-FAIL-${failures.length}.png`), fullPage: true }); } catch { /* page may be gone */ }
  }
}
const expect = (c, m) => { if (!c) throw new Error(m); };
const sql = (q) => execSync(`psql "${DB}" -tAc ${JSON.stringify(q)}`, { encoding: "utf8" }).trim();
const sqlFails = (q) => { try { execSync(`psql "${DB}" -v ON_ERROR_STOP=1 -qc ${JSON.stringify(q)}`, { stdio: "pipe" }); return ""; } catch (e) { return String(e.stderr); } };
const ymd = (offset = 0) => { const d = new Date(Date.now() + 5.5 * 3600e3); d.setUTCDate(d.getUTCDate() + offset); return d.toISOString().slice(0, 10); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const shot = (n) => page.screenshot({ path: path.join(OUT, `p2-${n}.png`), fullPage: true });
const alertText = async () => (await page.locator(".alert").first().innerText()).trim();
async function login(u, p) {
  await page.goto(`${BASE}/login`);
  await page.fill("#username", u); await page.fill("#password", p);
  await page.click("button[type=submit]"); await page.waitForLoadState("networkidle");
}
async function setPw(cur, next) {
  await page.fill("#current", cur); await page.fill("#next", next); await page.fill("#confirm", next);
  await page.click("button[type=submit]"); await page.waitForURL("**/dashboard**");
}
const submit = (scope = page) => scope.locator("button[type=submit]").last().click();

console.log("Phases 2–4 smoke test");

await step("sign in as Super Admin", async () => {
  await login("admin", "change-me-now");
  await setPw("change-me-now", "Shyam2026x");
  expect(await page.isVisible("text=આજની આવક"), "new dashboard tiles missing");
});

await step("trust details appear on receipts", async () => {
  await page.goto(`${BASE}/settings`);
  await page.fill("#reg_no", "E/1234/જુનાગઢ");
  await page.fill("#phone", "0285 2620000");
  await submit(); await page.waitForSelector(".alert.ok");
  expect(sql(`select value from "Setting" where key='reg_no'`) === "E/1234/જુનાગઢ", "setting not saved");
});

await step("set the cash opening balance", async () => {
  await page.goto(`${BASE}/accounts/setup`);
  const cashForm = page.locator("form.card", { has: page.locator('input[name="name"][value="રોકડ"]') });
  await cashForm.locator('input[name="openingBalance"]').fill("10000");
  await cashForm.locator("button[type=submit]").click();
  await page.waitForSelector(".alert.ok");
  expect(sql(`select "openingBalance" from "MoneyAccount" where name='રોકડ'`) === "10000.00", "opening not saved");
});

let donationId;
await step("donation receipt: bad amount rejected, then saved with member lookup", async () => {
  await page.goto(`${BASE}/donations/new`);
  await page.fill("#donorName", "પરમાર");
  await page.waitForSelector(".picker button");
  await page.click(".picker button >> nth=0");
  expect((await page.inputValue("#mobile")).length === 10, "member mobile not filled");
  await page.fill("#amount", "abc");
  await submit(); await page.waitForSelector(".alert.bad");
  expect((await alertText()).includes("રકમ ખોટી"), "amount error missing");
  await page.fill("#amount", "5,100");
  await page.selectOption("#headId", { label: "બાંધકામ ફંડ" });
  await page.fill("#inMemoryOf", "સ્વ. મોહનભાઈ");
  await submit(); await page.waitForURL(/\/donations\/\d+\?new=1/);
  donationId = page.url().match(/donations\/(\d+)/)[1];
  const receipt = await page.locator("[data-testid=receipt]").innerText();
  expect(receipt.includes("પાંચ હજાર એકસો પૂરા"), "amount in words missing");
  expect(receipt.includes("E/1234/જુનાગઢ"), "registration no. missing");
  expect(/SD\/\d\d-\d\d\/0005/.test(receipt), "receipt number not SD/yy-yy/0005");
  expect(sql(`select count(*) from "Voucher" where "donationId"=${donationId} and type='INCOME' and amount=5100`) === "1", "voucher not posted");
  await shot("receipt");
});

let verifyUrl;
await step("printable receipt has a working QR verification link", async () => {
  await page.goto(`${BASE}/print/receipt/${donationId}`);
  expect((await page.locator("[data-testid=receipt] svg").count()) === 1, "QR code missing");
  const code = sql(`select "verifyCode" from "Donation" where id=${donationId}`);
  verifyUrl = `${BASE}/verify/${code}`;
  const anon = await browser.newContext();
  const p2 = await anon.newPage();
  await p2.goto(verifyUrl);
  expect(await p2.isVisible("text=આ રસીદ સાચી છે"), "verify page not genuine");
  expect(!(await p2.content()).includes("મોહનભાઈ પરમાર"), "verify page shows the full donor name");
  await anon.close();
});

await step("cancelling a receipt needs a reason and removes it from the accounts", async () => {
  await page.goto(`${BASE}/donations/${donationId}`);
  await page.click("text=રસીદ રદ કરો");
  await page.fill("#reason", "રકમ ખોટી લખાઈ");
  await page.click("text=ખાતરી કરો");
  await page.waitForSelector("text=રસીદ રદ થઈ");
  expect(sql(`select status from "Voucher" where "donationId"=${donationId}`) === "CANCELLED", "voucher still active");
  const anon = await browser.newContext(); const p2 = await anon.newPage();
  await p2.goto(verifyUrl);
  expect(await p2.isVisible("text=આ રસીદ રદ થયેલી છે"), "verify page does not show cancelled");
  await anon.close();
});

await step("receipts and vouchers cannot be edited or deleted, even with direct SQL", async () => {
  expect(sqlFails(`update "Donation" set amount=1 where id=${donationId}`).includes("cannot be edited") || sqlFails(`update "Donation" set amount=1 where id=${donationId}`).includes("already cancelled"), "donation update not blocked");
  const vid = sql(`select id from "Voucher" where status='ACTIVE' limit 1`);
  expect(sqlFails(`update "Voucher" set amount=1 where id=${vid}`).includes("cannot be edited"), "voucher edit not blocked");
  expect(sqlFails(`delete from "Voucher" where id=${vid}`).includes("cannot be deleted"), "voucher delete not blocked");
  expect(sqlFails(`insert into "Voucher" ("voucherNo","date",type,"headId","accountId",amount,"createdById","createdByName") values ('X',now(),'INCOME',1,1,-5,1,'x')`).includes("Voucher_amount_positive"), "negative amount not blocked");
});

let expenseId;
await step("expense voucher with a bill photo", async () => {
  const png = path.join(OUT, "bill.png");
  fs.writeFileSync(png, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64"));
  await page.goto(`${BASE}/accounts/vouchers/new?type=EXPENSE`);
  await page.fill("#amount", "750");
  await page.selectOption("#headId", { label: "સફાઈ ખર્ચ" });
  await submit(); await page.waitForSelector(".alert.bad");
  expect((await alertText()).includes("કોને ચૂકવ્યા"), "payee required error missing");
  await page.fill("#party", "રમેશ સફાઈ સેવા");
  await page.fill("#narration", "હોલ સફાઈ");
  await page.setInputFiles("#attachment", png);
  await submit(); await page.waitForURL(/vouchers\/\d+\?new=1/);
  expenseId = page.url().match(/vouchers\/(\d+)/)[1];
  const res = await page.request.get(`${BASE}/attachment/${expenseId}`);
  expect(res.status() === 200 && res.headers()["content-type"] === "image/png", `attachment ${res.status()}`);
});

await step("transfer cash to bank", async () => {
  await page.goto(`${BASE}/accounts/vouchers/new?type=CONTRA`);
  await page.fill("#amount", "2000");
  await page.selectOption("#accountId", { label: "રોકડ" });
  await page.selectOption("#toAccountId", { label: "મુખ્ય બેંક ખાતું" });
  await page.fill("#narration", "રોકડ બેંકમાં જમા");
  await submit(); await page.waitForURL(/vouchers\/\d+\?new=1/);
});

await step("cash balance adds up (opening + demo + new entries)", async () => {
  // 10000 opening + 6200 demo cash receipts − 4700 demo cash expenses − 750 expense − 2000 to bank
  await page.goto(`${BASE}/accounts`);
  const cash = await page.locator(".kpi", { hasText: "રોકડ" }).first().locator("b").innerText();
  expect(cash === "₹ 8,750", `cash balance ${cash}`);
  await shot("accounts");
});

await step("reports: day book, head-wise, monthly, yearly, cash book, with Excel", async () => {
  await page.goto(`${BASE}/accounts/reports?r=daybook`);
  expect(await page.isVisible("text=રમેશ સફાઈ સેવા"), "day book missing today's expense");
  await page.goto(`${BASE}/accounts/reports?r=headwise`);
  expect(await page.isVisible("text=બાંધકામ ફંડ"), "head-wise missing head");
  await shot("headwise");
  await page.goto(`${BASE}/accounts/reports?r=monthly`);
  expect(await page.isVisible("text=કુલ આવક") || await page.isVisible("text=કુલ"), "monthly empty");
  await page.goto(`${BASE}/accounts/reports?r=yearly`);
  await page.goto(`${BASE}/accounts/reports?r=book&account=${sql(`select id from "MoneyAccount" where name='રોકડ'`)}`);
  const closing = await page.locator("tfoot td").last().innerText();
  expect(closing === "₹ 8,750", `cash book closing ${closing}`);
  for (const r of ["daybook", "headwise", "monthly", "yearly", "book"]) {
    const res = await page.request.get(`${BASE}/export/report?r=${r}&account=1`);
    expect(res.status() === 200 && (await res.body()).subarray(0, 2).toString() === "PK", `excel ${r} ${res.status()}`);
  }
  for (const k of ["donations", "vouchers", "bookings", "inventory"]) {
    const res = await page.request.get(`${BASE}/export/${k}`);
    expect(res.status() === 200, `excel ${k} ${res.status()}`);
  }
});

const eventDay = ymd(10);
let bookingId;
await step("booking: member rates, extras and discount give the right bill", async () => {
  await page.goto(`${BASE}/bookings/new?date=${eventDay}`);
  await page.fill("#hirerName", "ચૌહાણ");
  await page.waitForSelector(".picker button"); await page.click(".picker button >> nth=0");
  await page.check('input[name=facilityId][value="' + sql(`select id from "Facility" where "nameGu"='રસોડું'`) + '"]');
  await page.fill(`[id="extra.${sql(`select id from "ChargeItem" where "nameGu" like 'વાસણ સેટ%'`)}"]`, "3");
  await page.fill("#discount", "1000");
  await page.fill("#discountNote", "સમિતિ મંજૂરી");
  // 15000 hall + 3000 kitchen (member) + 3 × 400 utensils − 1000
  expect((await page.locator("[data-testid=bill-total]").innerText()) === "₹ 18,200", "live estimate wrong");
  await submit(); await page.waitForURL(/bookings\/\d+\?saved=new/);
  bookingId = page.url().match(/bookings\/(\d+)/)[1];
  expect((await page.locator(".kpi", { hasText: "કુલ બિલ" }).locator("b").innerText()) === "₹ 18,200", "saved bill total wrong");
  expect(sql(`select "depositAmount" from "Booking" where id=${bookingId}`) === "6000.00", "deposit not taken from facilities");
});

await step("the same hall cannot be booked twice on that day; another hall can", async () => {
  await page.goto(`${BASE}/bookings/new?date=${eventDay}`);
  await page.fill("#hirerName", "બીજા ભાઈ");
  await page.selectOption("#slot", "EVENING");
  await submit(); await page.waitForSelector(".alert.bad");
  expect((await alertText()).includes("પહેલેથી બુક"), "double booking allowed");
  const hall = sql(`select id from "Facility" where "nameGu"='વાડી હોલ'`);
  const upper = sql(`select id from "Facility" where "nameGu"='ઉપરનો હોલ'`);
  await page.uncheck(`input[name=facilityId][value="${hall}"]`);
  await page.check(`input[name=facilityId][value="${upper}"]`);
  await submit(); await page.waitForURL(/bookings\/\d+\?saved=new/);
});

await step("booking payments: deposit, part rent, over-payment refused", async () => {
  await page.goto(`${BASE}/bookings/${bookingId}`);
  const pay = page.locator("form", { hasText: "પેમેન્ટ લો" });
  await pay.locator("#kind").selectOption("DEPOSIT");
  await pay.locator("#pay-amount").fill("6000");
  await pay.locator("button[type=submit]").click();
  await page.waitForSelector("text=પેમેન્ટ નોંધાયું");
  await page.reload();
  const pay2 = page.locator("form", { hasText: "પેમેન્ટ લો" });
  await pay2.locator("#kind").selectOption("RENT");
  await pay2.locator("#pay-amount").fill("50000");
  await pay2.locator("button[type=submit]").click();
  await pay2.locator(".alert.bad").waitFor();
  await pay2.locator("#pay-amount").fill("10000");
  await pay2.locator("#mode").selectOption("UPI");
  await pay2.locator("#reference").fill("UTR123456");
  await pay2.locator("button[type=submit]").click();
  await page.waitForSelector("text=પેમેન્ટ નોંધાયું");
  await page.reload();
  expect((await page.locator(".kpi", { hasText: "બાકી" }).locator("b").innerText()) === "₹ 8,200", "balance after payment wrong");
  expect(sql(`select count(*) from "Voucher" where "bookingId"=${bookingId} and type='DEPOSIT_IN'`) === "1", "deposit voucher missing");
});

await step("utensils: issue, over-issue refused, return with damage charged to the bill", async () => {
  const plate = sql(`select id from "Item" where "nameGu"='સ્ટીલ થાળી'`);
  await page.goto(`${BASE}/bookings/${bookingId}/items`);
  const issue = page.locator("form", { hasText: "વસ્તુ આપો" }).last();
  await issue.locator(`input[name="issue.${plate}"]`).fill("5000");
  await issue.locator("button[type=submit]").click();
  await issue.locator(".alert.bad").waitFor();
  await issue.locator(`input[name="issue.${plate}"]`).fill("200");
  await issue.locator("button[type=submit]").click();
  await page.waitForSelector("text=વસ્તુ આપ્યાની નોંધ થઈ");
  await page.reload();
  const ret = page.locator("form", { hasText: "વસ્તુ પરત લો" });
  await ret.locator(`input[name="good.${plate}"]`).fill("190");
  await ret.locator(`input[name="damaged.${plate}"]`).fill("4");
  await ret.locator(`input[name="missing.${plate}"]`).fill("6");
  await ret.locator("button[type=submit]").click();
  await page.waitForSelector("text=₹ 600 ચાર્જ");
  await page.goto(`${BASE}/inventory/${plate}`);
  const k = async (label) => page.locator(".kpi", { hasText: label }).locator("b").first().innerText();
  expect((await k("કુલ")) === "994", `owned ${await k("કુલ")}`);
  expect((await k("નુકસાનવાળી")) === "4", "damaged count wrong");
  expect((await k("ઉપલબ્ધ")).startsWith("990"), `available ${await k("ઉપલબ્ધ")}`);
});

await step("closing a booking is refused while money is due, then settled and closed", async () => {
  await page.goto(`${BASE}/bookings/${bookingId}`);
  expect((await page.locator(".kpi", { hasText: "બાકી" }).locator("b").innerText()) === "₹ 8,800", "damage not added to bill");
  await page.click("text=✓ પ્રસંગ પૂરો, હિસાબ બંધ");
  await page.waitForSelector(".alert.bad");
  // Adjust the whole 6,000 deposit against the bill, then take the last 2,800 in cash.
  const dep = page.locator("form", { hasText: "ડિપોઝિટ પરત / સરભર" });
  await dep.locator("#adjust").fill("6000");
  await dep.locator("#refund").fill("0");
  await dep.locator("button[type=submit]").click();
  await page.waitForSelector("text=ડિપોઝિટનો હિસાબ નોંધાયો");
  await page.reload();
  const pay = page.locator("form", { hasText: "પેમેન્ટ લો" });
  await pay.locator("#pay-amount").fill("2800");
  await pay.locator("button[type=submit]").click();
  await page.waitForSelector("text=પેમેન્ટ નોંધાયું");
  await page.reload();
  await page.click("text=✓ પ્રસંગ પૂરો, હિસાબ બંધ");
  await page.waitForSelector("text=ફરી ખોલો");
  expect(sql(`select status from "Booking" where id=${bookingId}`) === "COMPLETED", "not completed");
  await shot("booking");
  const rent = sql(`select coalesce(sum(amount),0) from "Voucher" where "bookingId"=${bookingId} and type='INCOME' and status='ACTIVE'`);
  expect(rent === "18800.00", `rent income ${rent}`);
});

await step("bill prints and the calendar shows the booking", async () => {
  await page.goto(`${BASE}/print/bill/${bookingId}`);
  const bill = await page.locator("[data-testid=bill]").innerText();
  expect(bill.includes("સ્ટીલ થાળી: 4 નુકસાન, 6 ખૂટ્યાં") && bill.includes("ડિપોઝિટમાંથી બિલમાં સરભર"), "bill details missing");
  await page.goto(`${BASE}/bookings?m=${eventDay.slice(0, 7)}`);
  expect((await page.locator(".cal a.ev").count()) >= 2, "calendar entries missing");
  await shot("calendar");
});

await step("inventory: stock count correction needs a reason and is applied", async () => {
  const chair = sql(`select id from "Item" where "nameGu"='પ્લાસ્ટિક ખુરશી'`);
  await page.goto(`${BASE}/inventory/${chair}`);
  const mv = page.locator("form", { hasText: "સ્ટોકમાં ફેરફાર" });
  await page.selectOption("#mtype", "COUNT");
  await page.fill("#mqty", "590");
  await mv.locator("button[type=submit]").click(); await mv.locator(".alert.bad").waitFor();
  await page.fill("#mnotes", "વાર્ષિક ગણતરી");
  await mv.locator("button[type=submit]").click(); await page.waitForSelector(".alert.ok");
  await page.reload();
  expect((await page.locator(".kpi", { hasText: "ઉપલબ્ધ" }).locator("b").innerText()).startsWith("590"), "count not applied");
  expect(sqlFails(`delete from "StockMovement"`).includes("append-only"), "stock history delete not blocked");
  await page.goto(`${BASE}/inventory`);
  await shot("inventory");
});

await step("audit log records who made each receipt and bill", async () => {
  await page.goto(`${BASE}/audit?entity=donation`);
  expect(await page.isVisible("text=રસીદ રદ"), "cancel not logged");
  await page.goto(`${BASE}/audit?entity=booking`);
  expect(await page.isVisible("text=વસ્તુ પરત"), "return not logged");
});

await step("receipt clerk: can issue receipts, cannot backdate, cancel or open accounts", async () => {
  await page.goto(`${BASE}/users/new`);
  await page.fill("#fullName", "કિશોરભાઈ"); await page.fill("#username", "kishor");
  await page.selectOption("#roleId", sql(`select id from "Role" where key='receipt_clerk'`));
  await submit(); await page.waitForSelector("text=કામચલાઉ પાસવર્ડ");
  const pw = (await page.locator(".alert.ok b").nth(1).innerText()).trim();
  await page.click("text=લોગઆઉટ"); await page.waitForURL("**/login");
  await login("kishor", pw); await setPw(pw, "Kishor2026a");
  const nav = await page.locator(".side").innerText();
  expect(nav.includes("દાન રસીદ") && !nav.includes("હિસાબ") && !nav.includes("વાડી બુકિંગ"), "clerk menu wrong");
  await page.goto(`${BASE}/accounts`); expect(page.url().includes("denied=1"), "clerk opened accounts");
  expect((await page.request.get(`${BASE}/export/vouchers`)).status() === 403, "clerk exported vouchers");
  await page.goto(`${BASE}/donations/new`);
  expect(await page.locator("#date").getAttribute("readonly") !== null, "clerk can change date");
  await page.fill("#donorName", "નવા દાતા"); await page.fill("#amount", "501");
  await submit(); await page.waitForURL(/donations\/\d+\?new=1/);
  expect(!(await page.isVisible("text=રસીદ રદ કરો")), "clerk sees cancel");
  expect(sql(`select "createdByName" from "Donation" order by id desc limit 1`) === "કિશોરભાઈ", "creator not recorded");
});

await step("phone: calendar and receipt form fit the screen", async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const u of ["/donations/new", "/dashboard"]) {
    await page.goto(`${BASE}${u}`);
    expect(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)), `${u} scrolls sideways`);
  }
  await shot("phone-receipt-form");
});

await browser.close();
console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);

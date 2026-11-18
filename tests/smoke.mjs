// End-to-end smoke test for phase 1. Run against a freshly reset test database:
//   ./tests/reset-test-db.sh && (start the app on BASE_URL) && node tests/smoke.mjs
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  ({ chromium } = require("@playwright/test"));
}

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const DB = process.env.TEST_DATABASE_URL ?? "postgresql://shyamdham:shyamdham@localhost:5432/shyamdham_test";
const OUT = path.resolve("tests/output");
fs.mkdirSync(OUT, { recursive: true });

let passed = 0;
const failures = [];
async function step(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failures.push(name);
    console.log(`  ✗ ${name}\n      ${String(e.message ?? e).split("\n")[0]}`);
  }
}
function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}
const sql = (q) => execSync(`psql "${DB}" -tAc ${JSON.stringify(q)}`, { encoding: "utf8" }).trim();

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const shot = (name) => page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });

async function login(u, p) {
  await page.goto(`${BASE}/login`);
  await page.fill("#username", u);
  await page.fill("#password", p);
  await page.click("button[type=submit]");
  await page.waitForLoadState("networkidle");
}
async function logout() {
  await page.click("text=લોગઆઉટ");
  await page.waitForURL("**/login");
}

console.log("Phase 1 smoke test");

await step("unauthenticated visit redirects to login", async () => {
  await page.goto(`${BASE}/members`);
  expect(page.url().endsWith("/login"), `at ${page.url()}`);
});

await step("wrong password is rejected and logged", async () => {
  await login("admin", "wrong-password");
  expect(await page.isVisible("text=યુઝરનેમ અથવા પાસવર્ડ ખોટો છે."), "no error shown");
  expect(Number(sql(`select count(*) from "AuditLog" where action='login_failed'`)) >= 1, "no audit row");
});

await step("first login forces a password change", async () => {
  await login("admin", "change-me-now");
  expect(page.url().includes("/change-password"), `at ${page.url()}`);
  await shot("01-change-password");
  await page.fill("#current", "change-me-now");
  await page.fill("#next", "12345678");
  await page.fill("#confirm", "12345678");
  await page.click("button[type=submit]");
  await page.waitForSelector("text=પાસવર્ડમાં અક્ષર અને આંકડો બંને જોઈએ.");
  await page.fill("#current", "change-me-now");
  await page.fill("#next", "Shyam2026x");
  await page.fill("#confirm", "Shyam2026x");
  await page.click("button[type=submit]");
  await page.waitForURL("**/dashboard**");
});

await step("dashboard shows family counts", async () => {
  expect(await page.isVisible("text=કુલ પરિવાર"), "no KPI");
  const v = await page.locator(".kpi", { hasText: "કુલ પરિવાર" }).locator("b").innerText();
  const families = sql(`select count(*) from "Family" where "isActive"`);
  expect(v === families, `families KPI = ${v}, database has ${families}`);
  await shot("02-dashboard");
});

await step("directory lists and searches families", async () => {
  await page.goto(`${BASE}/members`);
  const families = Number(sql(`select count(*) from "Family" where "isActive"`));
  const rows = await page.locator("table.t tbody tr").count();
  expect(rows === families, `expected ${families} rows, got ${rows}`);
  await page.fill("#q", "ચૌહાણ");
  await page.click("form.card button[type=submit]");
  await page.waitForURL("**q=**");
  const chauhan = Number(sql(`select count(distinct f.id) from "Family" f join "Member" m on m."familyId"=f.id where f."isActive" and (m.surname like '%ચૌહાણ%' or m."firstName" like '%ચૌહાણ%' or m."fatherName" like '%ચૌહાણ%')`));
  const found = await page.locator("table.t tbody tr").count();
  expect(found === chauhan && found < families, `search found ${found}, expected ${chauhan}`);
  await page.goto(`${BASE}/members?view=people&blood=B%2B`);
  const n = await page.locator("table.t tbody tr").count();
  const bplus = Number(sql(`select count(*) from "Member" m join "Family" f on f.id=m."familyId" where f."isActive" and m."bloodGroup"='B+'`));
  expect(n === bplus, `B+ people = ${n}, expected ${bplus}`);
  await page.goto(`${BASE}/members`);
  await shot("03-directory");
});

let newFamilyNo = "";
let newFamilyId = "";
await step("register a family: validation, then save", async () => {
  await page.goto(`${BASE}/members/new`);
  await page.fill('[id="members.0.firstName"]', "મહેશભાઈ");
  await page.fill('[id="members.0.fatherName"]', "રામજીભાઈ");
  await page.fill('[id="members.0.surname"]', "ગોહેલ");
  await page.selectOption('[id="members.0.gender"]', "M");
  await page.fill('[id="members.0.dob"]', "1975-06-15");
  await page.fill('[id="members.0.mobile"]', "12345");
  await page.fill("#vatan", "મેંદરડા");
  await page.fill("#area", "જોષીપરા");
  await page.fill("#address", "12, શાંતિ સોસાયટી");
  await page.click("text=+ સભ્ય ઉમેરો");
  await page.fill('[id="members.1.firstName"]', "હેતલબેન");
  await page.selectOption('[id="members.1.relation"]', "પત્ની");
  await page.selectOption('[id="members.1.gender"]', "F");
  await page.click("button[type=submit]");
  await page.waitForSelector(".alert.bad");
  expect(await page.isVisible("text=મોબાઈલ નંબર 10 આંકડાનો હોવો જોઈએ."), "mobile error not shown");
  expect((await page.inputValue('[id="members.0.gender"]')) === "M", "gender drop-down was reset after the error");
  expect((await page.inputValue('[id="members.1.relation"]')) === "પત્ની", "relation drop-down was reset after the error");
  await shot("04-family-form-error");
  await page.fill('[id="members.0.mobile"]', "9000000099");
  newFamilyNo = `M-${String(Number(sql(`select coalesce(max(value),0) from "Counter" where key='family'`)) + 1).padStart(5, "0")}`;
  await page.click("button[type=submit]");
  await page.waitForURL(/\/members\/\d+\?saved=new/);
  newFamilyId = page.url().match(/members\/(\d+)/)[1];
  expect(await page.isVisible(`text=પરિવાર ${newFamilyNo} નોંધાઈ ગયો.`), `success message missing (expected ${newFamilyNo})`);
  expect(sql(`select count(*) from "Member" where "familyId"=${newFamilyId}`) === "2", "2 members expected");
  await shot("05-family-detail");
});

await step("duplicate head mobile is blocked", async () => {
  await page.goto(`${BASE}/members/new`);
  await page.fill('[id="members.0.firstName"]', "ટેસ્ટ");
  await page.fill('[id="members.0.surname"]', "ટેસ્ટ");
  await page.fill('[id="members.0.mobile"]', "9000000010");
  await page.click("button[type=submit]");
  await page.waitForSelector(".alert.bad");
  expect(await page.isVisible("text=M-00001"), "duplicate owner not named");
});

await step("edit a family writes a field-level history entry", async () => {
  expect(newFamilyId, "no family was registered in the previous step");
  await page.goto(`${BASE}/members/${newFamilyId}/edit`);
  await page.fill("#area", "મધુરમ");
  await page.fill('[id="members.1.mobile"]', "9000000098");
  await page.click("button[type=submit]");
  await page.waitForURL(/saved=edit/);
  const ch = sql(`select changes::text from "AuditLog" where action='edit' and entity='family' order by id desc limit 1`);
  expect(ch.includes("જોષીપરા") && ch.includes("મધુરમ") && ch.includes("9000000098"), `changes: ${ch}`);
  expect(await page.isVisible("text=ફેરફારનો ઇતિહાસ"), "history section missing");
});

await step("Excel export downloads and is logged", async () => {
  const res = await page.request.get(`${BASE}/members-export?area=${encodeURIComponent("મધુરમ")}`);
  expect(res.status() === 200, `status ${res.status()}`);
  expect((res.headers()["content-type"] ?? "").includes("spreadsheetml"), "wrong content type");
  const body = await res.body();
  expect(body.subarray(0, 2).toString() === "PK", "not an xlsx");
});

await step("import: errors are reported, nothing written", async () => {
  const bad = path.join(OUT, "import-bad.csv");
  fs.writeFileSync(bad, "﻿પરિવાર કોડ,સંબંધ,નામ,પિતા/પતિનું નામ,અટક,મોબાઈલ,જન્મ તારીખ (dd/mm/yyyy),વિસ્તાર\nA,સ્વયં,દિલીપભાઈ,,ટાંક,9000000150,01/02/1980,ગાંધીગ્રામ\nA,પત્ની,,,,,,\nB,પુત્ર,કિરણ,,ચૌહાણ,,,\nC,સ્વયં,રાજેશભાઈ,,પરમાર,9000000010,31/02/1985,\n");
  const before = sql(`select count(*) from "Family"`);
  await page.goto(`${BASE}/members/import`);
  await page.setInputFiles("input[type=file]", bad);
  await page.click("text=ફાઇલ તપાસો");
  await page.waitForSelector(".alert.bad");
  const rows = await page.locator("table.t tbody tr").count();
  expect(rows >= 3, `expected ≥3 problems, got ${rows}`);
  await shot("06-import-errors");
  expect(sql(`select count(*) from "Family"`) === before, "families were written");
});

await step("import: valid file creates families", async () => {
  const good = path.join(OUT, "import-good.csv");
  fs.writeFileSync(good, "﻿પરિવાર કોડ,સંબંધ,નામ,પિતા/પતિનું નામ,અટક,જાતિ (પુ/સ્ત્રી),મોબાઈલ,જન્મ તારીખ (dd/mm/yyyy),બ્લડ ગ્રુપ,વિસ્તાર,મૂળ વતન\n101,સ્વયં,દિલીપભાઈ,ગોવિંદભાઈ,ટાંક,પુ,+91 90000 00150,01/02/1980,O+,ગાંધીગ્રામ,બિલખા\n101,પત્ની,ભારતીબેન,દિલીપભાઈ,ટાંક,સ્ત્રી,,15/07/1983,A+,,\n102,સ્વયં,નરેશભાઈ,હરિભાઈ,સોલંકી,પુ,9000000160,,B-,દોલતપરા,ભેસાણ\n");
  const importLogs = Number(sql(`select count(*) from "AuditLog" where action='import'`));
  await page.goto(`${BASE}/members/import`);
  await page.setInputFiles("input[type=file]", good);
  await page.click("text=ફાઇલ તપાસો");
  await page.waitForSelector(".alert.ok");
  await shot("07-import-preview");
  await page.click("text=2 પરિવાર આયાત કરો");
  await page.waitForSelector("text=2 પરિવાર અને 3 સભ્યો આયાત થયા.");
  expect(sql(`select mobile from "Member" where "firstName"='દિલીપભાઈ' and surname='ટાંક' order by id desc limit 1`) === "9000000150", "mobile not normalised");
  expect(Number(sql(`select count(*) from "AuditLog" where action='import'`)) === importLogs + 3, "import audit rows");
});

let clerkPw = "";
await step("create a receipt-clerk user with a temporary password", async () => {
  await page.goto(`${BASE}/users/new`);
  await page.fill("#fullName", "કિશોરભાઈ");
  await page.fill("#username", "kishor");
  await page.fill("#mobile", "9000000201");
  const clerkRole = sql(`select id from "Role" where key='receipt_clerk'`);
  await page.selectOption("#roleId", clerkRole);
  await page.click("button[type=submit]");
  await page.waitForSelector("text=કામચલાઉ પાસવર્ડ");
  clerkPw = (await page.locator(".alert.ok b").nth(1).innerText()).trim();
  expect(/^Sd\d{4}[a-z]{3}$/.test(clerkPw), `temp pw ${clerkPw}`);
  await shot("08-user-created");
});

await step("roles matrix renders", async () => {
  await page.goto(`${BASE}/roles`);
  expect(await page.isVisible("text=રસીદ ક્લાર્ક"), "role column missing");
  await shot("09-roles");
});

await step("audit log shows who did what", async () => {
  await page.goto(`${BASE}/audit`);
  expect(await page.isVisible("text=નવો યુઝર: કિશોરભાઈ"), "user creation not logged");
  await page.selectOption("#action", "import");
  await page.click("text=ફિલ્ટર");
  await page.waitForURL("**action=import**");
  expect((await page.locator("table.t > tbody > tr").count()) === 3, "filter by action");
  await page.goto(`${BASE}/audit`);
  await shot("10-audit");
});

await step("audit log cannot be changed, even directly in the database", async () => {
  let blocked = false;
  try {
    execSync(`psql "${DB}" -v ON_ERROR_STOP=1 -qc "update \\"AuditLog\\" set summary='x'"`, { stdio: "pipe" });
  } catch (e) {
    blocked = String(e.stderr).includes("append-only");
  }
  expect(blocked, "UPDATE was not blocked");
  let delBlocked = false;
  try {
    execSync(`psql "${DB}" -v ON_ERROR_STOP=1 -qc "delete from \\"AuditLog\\""`, { stdio: "pipe" });
  } catch (e) {
    delBlocked = String(e.stderr).includes("append-only");
  }
  expect(delBlocked, "DELETE was not blocked");
});

await step("clerk: limited menu, blocked pages, can register", async () => {
  await logout();
  await login("kishor", clerkPw);
  expect(page.url().includes("/change-password"), "clerk not forced to change pw");
  await page.fill("#current", clerkPw);
  await page.fill("#next", "Kishor2026a");
  await page.fill("#confirm", "Kishor2026a");
  await page.click("button[type=submit]");
  await page.waitForURL("**/dashboard**");
  const nav = await page.locator(".side").innerText();
  expect(!nav.includes("ઓડિટ લોગ") && !nav.includes("યુઝર્સ"), "admin links visible to clerk");
  await page.goto(`${BASE}/audit`);
  expect(page.url().includes("denied=1"), "clerk reached audit log");
  await page.goto(`${BASE}/members/1/edit`);
  expect(page.url().includes("denied=1"), "clerk reached edit page");
  const res = await page.request.get(`${BASE}/audit-export`);
  expect(res.status() === 403, `audit export status ${res.status()}`);
  await page.goto(`${BASE}/members/new`);
  await page.fill('[id="members.0.firstName"]', "પ્રવીણભાઈ");
  await page.fill('[id="members.0.surname"]', "વાઘેલા");
  await page.click("button[type=submit]");
  await page.waitForURL(/saved=new/);
  const who = sql(`select "userName" from "AuditLog" where action='create' and entity='family' order by id desc limit 1`);
  expect(who === "કિશોરભાઈ", `logged as ${who}`);
  await shot("11-clerk-view");
});

await step("deactivating a family needs a reason and hides it", async () => {
  await logout();
  await login("admin", "Shyam2026x");
  const id = sql(`select id from "Family" where "familyNo"='M-00004'`);
  await page.goto(`${BASE}/members/${id}`);
  await page.click("text=પરિવાર બંધ કરો");
  await page.fill("#reason", "પરિવાર જુનાગઢ બહાર સ્થળાંતર");
  await page.click("text=ખાતરી કરો");
  await page.waitForSelector("text=પરિવાર ફરી ચાલુ કરો");
  await page.goto(`${BASE}/members`);
  expect(!(await page.isVisible("text=M-00004")), "inactive family still listed");
  expect(sql(`select summary from "AuditLog" where action='cancel' order by id desc limit 1`).includes("સ્થળાંતર"), "reason not logged");
});

await step("English switch", async () => {
  await page.goto(`${BASE}/lang?to=en&back=/members`);
  expect(await page.isVisible("text=Member directory"), "English heading missing");
  await shot("12-english");
  await page.goto(`${BASE}/lang?to=gu&back=/dashboard`);
});

await step("phone layout", async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/members/new`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(!overflow, "page scrolls sideways on phone");
  await shot("13-phone-form");
});

await browser.close();
console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);

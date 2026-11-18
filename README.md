# શ્યામધામ મધુરમ પોર્ટલ

Management portal for શ્યામધામ મધુરમ, શ્રી કડિયા જ્ઞાતિ, જુનાગઢ. Gujarati first, with an English switch.

Built so far: **phases 1–4**. WhatsApp sending, member messaging and OTP sign-in come last.

| Area | What works |
|---|---|
| Sign-in | Username and password, forced password change on first sign-in and after a reset, lock for 15 minutes after 5 wrong attempts, server-side sessions (7 days) |
| Users and roles | Module × action rights (view / create / edit / cancel). Only a Super Admin can grant Super Admin. Nobody can change their own role. |
| Audit log | Every sign-in, receipt, bill, voucher, payment, stock movement, edit (old → new), cancellation, import and export, with user, time, device and IP. Super Admin only. **Append-only at database level.** |
| Members | Families with members, directory search and filters, Excel import/export, printable directory |
| **Donation receipts** | Receipt from the member directory or any name, number `SD/26-27/0001` per financial year, Gujarati receipt with amount in words, PAN/80G text, QR code that opens a public verification page, print / save as PDF, register with filters and Excel. Never edited; cancelled with a reason, which also removes it from the accounts. Only people with edit rights can backdate. |
| **Accounts** | Income and expense heads, cash and bank accounts with opening balances, income / expense / transfer vouchers with a bill photo, day book, head-wise, monthly (April–March), yearly and cash/bank book reports, each with Excel and print. Vouchers cannot be edited or deleted, even directly in the database. |
| **Wadi booking** | Facilities with member and non-member rates and deposits, rate card for extras, month calendar, bookings that block double booking of the same facility and slot (also under simultaneous saves), discount, deposit, bill payments and deposit refunds or adjustments posted to the accounts automatically, damage charges, printable bill, close or cancel with checks. |
| **Inventory** | Items by category and place, stock kept as a history of movements (purchase, count correction, damaged, repaired, written off), low-stock warnings, issue to a booking and take back as good / damaged / missing, with charges added to that booking's bill. |
| Dashboard | Today's income and expense, month's donations, cash and bank balance, monthly chart, upcoming bookings, low stock, latest receipts and bills with who made them. Every figure drills down: KPI tiles open the matching filtered list, a month in the chart opens its head-wise breakdown, and a head opens its vouchers. |
| Trust details | Name, address, registration no., PAN, 80G wording and footers printed on receipts and bills (Super Admin). |
| **Gujarati typing** | Type English letters in any text field and Gujarati appears word by word (`ramesh` → રમેશ, `Rameshbhai Patel` → રમેશભાઈ પટેલ), on any keyboard. A dictionary covers common surnames, villages and words; a help panel lists the letter conventions. Toggle with the pill at the bottom right or Ctrl+G; numbers, mobile, PAN, usernames and English-name fields are left alone. |

Receipts and bills are printed or saved as PDF from the browser. Automatic PDF files and WhatsApp sending come with the last phase.

## Stack

Next.js 15 (App Router, server actions) · React 19 · TypeScript · PostgreSQL · Prisma 6 · ExcelJS. No external services are needed for phase 1.

## Run it locally

Needs Node 20+ and PostgreSQL 14+.

```bash
npm install
cp .env.example .env          # set DATABASE_URL and SEED_ADMIN_PASSWORD
npx prisma migrate deploy
npm run db:seed               # roles, pick-lists, first Super Admin
npm run dev                   # http://localhost:3000
```

Sign in as `admin` with `SEED_ADMIN_PASSWORD`; you will be asked to set a new password.

For a demo or test site only, `SEED_DEMO=1 npm run db:seed` also fills every screen with clearly fictional data: a user for each role (`trustee`, `accountant`, `clerk`, `wadi`, `store`; the password is `SEED_DEMO_PASSWORD`, see `.env.example`), trust details, ten families, a year of receipts, expenses and transfers, bookings in every state with payments, deposits and utensils issued and returned, stock history, and matching audit entries. Each part skips itself if its data already exists. Never run that on the live database.

## Locked out?

If a user (including the only Super Admin) forgets their password or is locked after 5 wrong attempts, run this on the server or your computer:

```bash
npm run user:reset-password -- admin NewTemp2026
```

It clears the lock, sets that temporary password, signs the user out everywhere, and records the reset in the audit log. The user must choose a new password at the next sign-in.

## Tests

Two end-to-end suites drive the app in Chromium against a separate database (`shyamdham_test`), 40 checks in all:

- `tests/smoke.mjs` (19): sign-in rules, members, import, users and roles, audit log.
- `tests/smoke-phase2.mjs` (21): receipts with QR verification and cancellation, database guards on money records, vouchers with a bill photo, transfers, every report and its Excel, a full booking (rates, double-booking block, deposit, payments, utensils issued and returned with damage charged, deposit adjustment, closing), stock counts, and a receipt clerk's limits.

```bash
npx playwright install chromium
```

```bash
npm run test:e2e
```

The first command is needed once per machine (it downloads the browser Playwright drives). The suites expect a local Postgres with the `shyamdham` role and recreate `shyamdham_test` on every run; they seed the demo data and check against it, so they do not depend on any particular demo figures.

Screenshots from each run are written to `tests/output/`.

## Deploying

Any Node host with a managed PostgreSQL works. Choose an India region (Mumbai) so data stays in the country and pages load quickly.

1. Create a PostgreSQL database and set `DATABASE_URL` on the host.
2. Build: `npm ci && npx prisma migrate deploy && npm run build`.
3. Start: `npm start` (listens on `PORT`, default 3000) behind HTTPS. Session cookies are marked `Secure` in production, so HTTPS is required.
4. Once, on the live database: `SEED_ADMIN_USERNAME=... SEED_ADMIN_PASSWORD=... npm run db:seed`. Account heads, the cash and bank accounts and the example facilities are created by the migrations themselves.
5. Optional: set `PUBLIC_URL` (e.g. `https://shyamdham-portal.onrender.com`) so receipt QR codes always point at the public address.
6. Turn on the provider's daily automatic backups.

Keep the test site on its own database.

## Code map

```
docs/                           project plan, wireframes, architecture.md (stack, architecture and schema diagrams)
prisma/schema.prisma            data model
prisma/migrations/              includes the audit-log and ledger triggers and the default heads, accounts and facilities
prisma/seed.ts, seed-demo.ts    roles, pick-lists, first Super Admin; optional demo data for every screen
src/lib/auth.ts                 sessions, password rules, lockout, permission guards
src/lib/permissions.ts          modules, actions, default roles
src/lib/audit.ts                audit writer and field diff
src/lib/members.ts              validation and directory queries
src/lib/import.ts, excel.ts     Excel/CSV import and export
src/lib/accounts.ts, reports.ts vouchers, balances and every accounts report
src/lib/bookings.ts             double-booking check and bill totals
src/lib/inventory.ts            stock from movements
src/lib/money.ts                rupees, amount in Gujarati words, financial year
src/lib/transliterate.ts        English letters → Gujarati for data entry (components/gujarati-typing.tsx)
src/lib/i18n-dict.ts            every Gujarati/English label
src/app/(app)/…                 signed-in pages
src/app/login, change-password  sign-in pages
tests/smoke.mjs, smoke-phase2.mjs  end-to-end tests · tests/transliterate.ts  typing-helper checks (npm run test:unit)
```

Every page checks the role on the server, and every server action checks it again before writing, so hiding a menu item is never the only protection.

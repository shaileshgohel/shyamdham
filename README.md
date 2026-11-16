# શ્યામધામ મધુરમ પોર્ટલ

Management portal for શ્યામધામ મધુરમ, શ્રી કડિયા જ્ઞાતિ, જુનાગઢ. Gujarati first, with an English switch.

This is **phase 1**: sign-in, users and roles, the audit log, and the member directory.

| Area | What works |
|---|---|
| Sign-in | Username and password, forced password change on first sign-in and after a reset, lock for 15 minutes after 5 wrong attempts, sessions stored server-side (7 days) |
| Users | Create, edit, switch off, reset password (temporary password shown once). Only a Super Admin can grant Super Admin or change a Super Admin's account. Nobody can change their own role or switch off their own account. The last active Super Admin cannot be removed. |
| Roles | Six starting roles from the plan, a module × action matrix (view / create / edit / cancel), new roles. Only a Super Admin changes rights. Rights for later modules can already be set. |
| Audit log | Every sign-in (including failures), create, edit (with old → new per field), deactivate, import and export, with user, time (IST), device and IP. Super Admin only. Filters and Excel export. **Append-only at database level**: a trigger rejects UPDATE, DELETE and TRUNCATE. |
| Members | Family registration with any number of members, a chosen head, validation (10-digit mobile, PAN, date of birth), one family per head mobile (also enforced by a database index). Edit, deactivate with reason, reactivate. Auto member numbers M-00001… |
| Directory | Search by name, surname, mobile or member no.; filter by village, area, occupation, blood group; family view and person view; Excel export; printable directory (browser print → Save as PDF). |
| Import | Excel/CSV template, row-by-row check with errors named by row, nothing written until the file is clean, then imported in one transaction. |
| Pick-lists | Villages, areas, occupations, education, editable by anyone with member edit rights. |

Later phases add donation receipts, accounts, wadi booking, inventory, and finally WhatsApp and OTP sign-in.

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

For a demo or test site only, `SEED_DEMO=1 npm run db:seed` also adds four clearly fictional families. Never run that on the live database.

## Tests

The end-to-end test resets a separate database (`shyamdham_test`), starts nothing itself, and drives the app in Chromium through 19 checks: sign-in rules, forced password change, directory search, family validation and save, duplicate head mobile, edit history, Excel export, import with errors and without, user creation, role limits for a receipt clerk, deactivation, the English switch, phone layout, and that the audit log cannot be changed even with direct SQL.

```bash
./tests/reset-test-db.sh
npm run build
DATABASE_URL=postgresql://shyamdham:shyamdham@localhost:5432/shyamdham_test npx next start -p 3100 &
node tests/smoke.mjs
```

Screenshots from each run are written to `tests/output/`.

## Deploying

Any Node host with a managed PostgreSQL works. Choose an India region (Mumbai) so data stays in the country and pages load quickly.

1. Create a PostgreSQL database and set `DATABASE_URL` on the host.
2. Build: `npm ci && npx prisma migrate deploy && npm run build`.
3. Start: `npm start` (listens on `PORT`, default 3000) behind HTTPS. Session cookies are marked `Secure` in production, so HTTPS is required.
4. Once, on the live database: `SEED_ADMIN_USERNAME=... SEED_ADMIN_PASSWORD=... npm run db:seed`.
5. Turn on the provider's daily automatic backups.

Keep the test site on its own database.

## Code map

```
prisma/schema.prisma            data model
prisma/migrations/              includes the audit-log trigger and head-mobile index
prisma/seed.ts                  roles, pick-lists, first Super Admin, optional demo data
src/lib/auth.ts                 sessions, password rules, lockout, permission guards
src/lib/permissions.ts          modules, actions, default roles
src/lib/audit.ts                audit writer and field diff
src/lib/members.ts              validation and directory queries
src/lib/import.ts, excel.ts     Excel/CSV import and export
src/lib/i18n-dict.ts            every Gujarati/English label
src/app/(app)/…                 signed-in pages
src/app/login, change-password  sign-in pages
tests/smoke.mjs                 end-to-end test
```

Every page checks the role on the server, and every server action checks it again before writing, so hiding a menu item is never the only protection.

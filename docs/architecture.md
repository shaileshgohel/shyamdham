# શ્યામધામ મધુરમ portal — architecture and data model

Diagrams are in Mermaid, so GitHub renders them in place. The same source feeds the published architecture page.

## Tech stack

| Layer | Choice | Notes |
| --- | --- | --- |
| UI | React 19, Next.js 15 App Router | Server components by default; small client islands (forms, member picker, Gujarati typing) |
| Language | TypeScript 5.9 | Strict; Zod 4 validates every form on the server |
| Styling | Hand-written CSS (`globals.css`) | Gujarati-first, phone layout, print styles for receipts and bills |
| Server | Next.js server actions and route handlers | Node runtime on the same process; no separate API server |
| Data access | Prisma 6 | Migrations in `prisma/migrations`, Decimal money columns |
| Database | PostgreSQL 16 | Append-only triggers on audit log, vouchers, donations and stock movements |
| Auth | Cookie session (`sd_session`), bcrypt 12 rounds | Token hash stored, lockout after failed logins, forced password change |
| Authorisation | Role permission matrix (`lib/permissions.ts`) | Six roles; super admin passes every check |
| Documents | ExcelJS, qrcode | Excel exports, printable receipts and bills with a QR verification link |
| i18n | Gujarati default, English toggle | Cookie-based; `t.g(gu, en)` helper |
| Gujarati input | `lib/transliterate.ts` + `GujaratiTyping` | English letters to Gujarati in any text field, Ctrl+G to toggle |
| Tests | Playwright (Chromium), tsx unit tests | 40 end-to-end checks against a throwaway database |
| Hosting | Render web service + managed PostgreSQL (Mumbai) | `npm ci && npx prisma migrate deploy && npm run build`, then `npm start` |

## Architecture

```mermaid
flowchart TB
  subgraph Client["Browser · phone or PC"]
    direction TB
    UI["Pages in Gujarati / English<br/>server-rendered HTML"]
    Islands["Client islands<br/>forms · member picker · Gujarati typing (Ctrl+G)"]
    Print["Print views<br/>receipt · bill · directory"]
  end

  subgraph Render["Render web service · Node 20 · HTTPS"]
    direction TB
    MW["middleware.ts<br/>no sd_session cookie → /login"]
    subgraph Next["Next.js 15 App Router"]
      direction LR
      Pages["(app) pages<br/>dashboard · members · donations<br/>accounts · bookings · inventory<br/>users · roles · lists · settings · audit"]
      Actions["Server actions<br/>Zod validation · one Prisma transaction<br/>audit row in the same transaction"]
      Routes["Route handlers<br/>/print/receipt · /print/bill · /verify/[code]<br/>/export/[kind] · /members-export · /attachment/[id]<br/>/api/member-search"]
    end
    subgraph Lib["src/lib — domain layer (server-only)"]
      direction LR
      Auth["auth · permissions<br/>session cookie, bcrypt, role matrix"]
      Domain["members · accounts · bookings<br/>inventory · reports · settings"]
      Cross["audit · money · format<br/>excel · sheet · i18n · transliterate"]
    end
    Prisma["Prisma 6 client<br/>Decimal money · FY counters (SD/WB/AV/JV/DP/DR/CT)"]
  end

  subgraph DB["PostgreSQL 16 · managed by Render"]
    direction TB
    Tables["Tables (see schema diagram)"]
    Triggers["Triggers<br/>AuditLog: no update / delete / truncate<br/>Voucher, Donation: cancel only, never edit or delete<br/>StockMovement: append-only"]
    Seed["Migrations seed account heads,<br/>cash + bank accounts, facilities;<br/>optional demo data (SEED_DEMO=1)"]
  end

  UI -- "GET page" --> MW
  Islands -- "POST server action" --> MW
  Print -- "GET" --> MW
  MW --> Pages
  MW --> Actions
  MW --> Routes
  Pages --> Lib
  Actions --> Lib
  Routes --> Lib
  Auth --> Prisma
  Domain --> Prisma
  Cross --> Prisma
  Prisma -- "TCP · sslmode=require" --> Tables
  Tables --- Triggers
  Tables --- Seed

  Public["Anyone with a receipt<br/>scans the QR"] -- "GET /verify/[code]" --> MW
  Excel["Excel files<br/>members · donations · vouchers<br/>bookings · inventory · reports"] -.- Routes
```

### Request lifecycle

1. The middleware only checks that the `sd_session` cookie exists; it never touches the database.
2. Every page and action calls `requirePage` / `requirePermission`, which loads the session, confirms the user is active and checks the role's permission for that module and verb.
3. A write runs in one Prisma transaction: validate with Zod, allocate the financial-year document number from `Counter`, write the record, append the `AuditLog` row with field-level changes.
4. Money never changes shape after it is written. Receipts and vouchers are cancelled with a reason and stay in the ledger; database triggers reject any other update or delete.
5. Reports and balances are computed from vouchers and stock movements; no balance or stock count is stored.

## Database schema

Two diagrams, split by module. Solid lines are real foreign keys. Dotted lines are soft links held as plain integer columns (`familyId` on donations and bookings) so a family can be removed without touching money records.

### Foundation and members

```mermaid
erDiagram
  Role {
    int id PK
    string key UK "super_admin, trustee, accountant, receipt_clerk, wadi_manager, store_keeper"
    string nameGu
    string nameEn
    boolean isSuperAdmin
    json permissions "{ module: [verbs] }"
  }
  User {
    int id PK
    string username UK
    string fullName
    string mobile
    string passwordHash "bcrypt"
    boolean mustChangePassword
    boolean isActive
    int failedLogins
    datetime lockedUntil
    datetime lastLoginAt
    int roleId FK
  }
  Session {
    int id PK
    string tokenHash UK "sha256 of cookie"
    int userId FK
    datetime expiresAt
    string ip
    string userAgent
  }
  AuditLog {
    bigint id PK
    datetime at
    int userId FK "nullable"
    string userName "snapshot"
    string action "login, create, edit, cancel, import, export..."
    string entity
    string entityId
    string docNo "M-00012, SD/26-27/0001..."
    string summary
    json changes "{ field: [old, new] }"
    string ip
    string device
  }
  Counter {
    string key PK "family, SD:26-27, WB:26-27..."
    int value
  }
  Setting {
    string key PK "trust_name, reg_no, pan, g80_text..."
    string value
  }
  MasterValue {
    int id PK
    string type "VATAN, AREA, OCCUPATION, EDUCATION"
    string value
    int sortOrder
  }
  Family {
    int id PK
    string familyNo UK "M-00001"
    string address
    string area
    string vatan
    string city
    string membershipType "આજીવન / સામાન્ય"
    string notes
    boolean isActive
    int createdById
  }
  Member {
    int id PK
    int familyId FK
    boolean isHead
    int sortOrder
    string firstName
    string fatherName
    string surname
    string relation
    string gender
    date dob
    string mobile
    string email
    string bloodGroup
    string education
    string occupation
    string maritalStatus
    string pan
    boolean isAlive
  }

  Role ||--o{ User : "has"
  User ||--o{ Session : "signs in"
  User |o--o{ AuditLog : "acted"
  Family ||--o{ Member : "cascade delete"
```

### Money, bookings and stock

```mermaid
erDiagram
  AccountHead {
    int id PK
    string type "INCOME / EXPENSE"
    string nameGu
    string nameEn
    string systemKey UK "donation_general, booking_rent, booking_damage..."
    boolean isActive
  }
  MoneyAccount {
    int id PK
    string kind "CASH / BANK"
    string name UK
    string bankDetails
    decimal openingBalance
    date openingDate
    boolean isActive
  }
  Voucher {
    int id PK
    string voucherNo UK "AV/JV/DP/DR/CT + FY + serial"
    date date
    string type "INCOME, EXPENSE, DEPOSIT_IN, DEPOSIT_OUT, CONTRA"
    int headId FK "nullable"
    int accountId FK
    int toAccountId FK "CONTRA only"
    decimal amount
    string mode "CASH, UPI, CHEQUE, BANK, ADJUST"
    string reference
    string party
    string narration
    string source "MANUAL, DONATION, BOOKING"
    int donationId FK "unique, nullable"
    int bookingId FK "nullable"
    bytes attachment "bill photo"
    string status "ACTIVE / CANCELLED"
    string cancelReason
    int createdById
    string createdByName
  }
  Donation {
    int id PK
    string receiptNo UK "SD/26-27/0001"
    string fy
    date date
    string donorName
    int familyId "soft link"
    string mobile
    string address
    string pan
    int headId FK
    decimal amount
    string mode
    string reference
    int accountId "money account"
    string inMemoryOf
    string verifyCode UK "behind the QR"
    string status "ACTIVE / CANCELLED"
    string cancelReason
    int createdById
    string createdByName
  }
  Facility {
    int id PK
    string nameGu UK
    string nameEn
    decimal memberRate "per day"
    decimal nonMemberRate
    decimal deposit
    boolean isActive
  }
  ChargeItem {
    int id PK
    string nameGu UK
    string unit
    decimal rate
    boolean isActive
  }
  Booking {
    int id PK
    string bookingNo UK "WB/26-27/0001"
    string fy
    string hirerName
    string mobile
    string address
    int familyId "soft link"
    boolean isMember
    string eventType
    date fromDate
    date toDate
    string slot "FULL / MORNING / EVENING"
    int guests
    decimal depositAmount "agreed"
    string status "CONFIRMED, COMPLETED, CANCELLED"
    string cancelReason
    int createdById
    string createdByName
  }
  BookingFacility {
    int id PK
    int bookingId FK
    int facilityId FK
  }
  BookingLine {
    int id PK
    int bookingId FK
    string kind "FACILITY, EXTRA, DAMAGE, MANUAL, DISCOUNT"
    string description
    decimal qty
    decimal rate
    decimal amount
  }
  Item {
    int id PK
    string nameGu UK
    string category "વાસણ, ફર્નિચર, બિછાત, ઇલેક્ટ્રિક, અન્ય"
    string location
    string unit
    int minQty
    decimal chargeRate "per piece lost or damaged"
    boolean isActive
  }
  StockMovement {
    int id PK
    int itemId FK
    date date
    string type "PURCHASE, ADJUST, ISSUE, RETURN, RETURN_DAMAGED, RETURN_MISSING, DAMAGED, REPAIRED, WRITE_OFF"
    int qty
    int bookingId FK "nullable"
    string notes
    int createdById
    string createdByName
  }
  Family {
    int id PK
    string familyNo UK
  }

  AccountHead ||--o{ Voucher : "classifies"
  AccountHead ||--o{ Donation : "classifies"
  MoneyAccount ||--o{ Voucher : "account"
  MoneyAccount |o--o{ Voucher : "toAccount (contra)"
  Donation |o--|| Voucher : "posts one INCOME"
  Booking ||--o{ Voucher : "deposits, rent, refunds"
  Booking ||--o{ BookingFacility : "cascade"
  Facility ||--o{ BookingFacility : ""
  Booking ||--o{ BookingLine : "bill lines, cascade"
  Booking |o--o{ StockMovement : "issue / return"
  Item ||--o{ StockMovement : "stock = sum"
  Family |o..o{ Donation : "familyId, no FK"
  Family |o..o{ Booking : "familyId, no FK"
```

### Integrity rules enforced in the database

| Table | Trigger | Rule |
| --- | --- | --- |
| AuditLog | `audit_log_no_update_delete`, `audit_log_no_truncate` | Append-only, even for a superuser session |
| Voucher | `voucher_ledger_guard`, `voucher_no_truncate` | Only `status`, `cancelReason`, `cancelledAt`, `cancelledById` may change; no delete |
| Donation | `donation_ledger_guard`, `donation_no_truncate` | Same cancel-only rule |
| StockMovement | `stock_movement_append_only` | No update or delete; corrections are new ADJUST rows |

### Document numbers

All numbers reset each financial year (April to March) and come from the `Counter` table inside the writing transaction, so two clerks never get the same number.

| Prefix | Document | Example |
| --- | --- | --- |
| M | Family | `M-00012` (never resets) |
| SD | Donation receipt | `SD/26-27/0001` |
| WB | Wadi booking | `WB/26-27/0001` |
| AV | Income voucher | `AV/26-27/0001` |
| JV | Expense voucher | `JV/26-27/0001` |
| DP / DR | Deposit in / deposit out | `DP/26-27/0001` |
| CT | Contra (cash to bank) | `CT/26-27/0001` |

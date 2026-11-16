// Creates the starting roles, the first Super Admin, and the pick-lists.
// Safe to run more than once. With SEED_DEMO=1 it also adds clearly fictional demo data for
// every screen (see seed-demo.ts) for the committee's test site — never on the live database.
// Load .env when this script runs on its own (Node 20.12+); variables already set in the shell win.
try {
  process.loadEnvFile?.(".env");
} catch {
  /* no .env file: rely on the shell environment */
}

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_ROLES } from "../src/lib/permissions";
import { seedDemoAll } from "./seed-demo";

const db = new PrismaClient();

const MASTERS: Record<string, string[]> = {
  VATAN: ["જુનાગઢ", "વંથલી", "કેશોદ", "માણાવદર", "વિસાવદર", "માંગરોળ", "મેંદરડા", "ભેસાણ", "માળિયા હાટીના", "બિલખા"],
  AREA: ["મધુરમ", "ઝાંઝરડા રોડ", "ટીંબાવાડી", "જોષીપરા", "ગાંધીગ્રામ", "દોલતપરા", "મોતીબાગ", "બસ સ્ટેન્ડ વિસ્તાર", "ખલીલપુર રોડ", "જુનાગઢ બહાર"],
  OCCUPATION: ["કડિયા કામ", "કોન્ટ્રાક્ટર", "બિલ્ડર", "વેપાર", "નોકરી", "સરકારી નોકરી", "એન્જિનિયર", "ડોક્ટર", "શિક્ષક", "ખેતી", "ગૃહિણી", "અભ્યાસ", "નિવૃત્ત"],
  EDUCATION: ["પ્રાથમિક", "ધો. 10", "ધો. 12", "ITI", "ડિપ્લોમા", "સ્નાતક", "અનુસ્નાતક", "B.E.", "MBBS", "CA", "અન્ય"],
};

async function main() {
  for (const r of DEFAULT_ROLES) {
    await db.role.upsert({
      where: { key: r.key },
      create: { key: r.key, nameGu: r.nameGu, nameEn: r.nameEn, isSuperAdmin: !!r.isSuperAdmin, permissions: r.permissions },
      update: {}, // never overwrite rights the Super Admin has changed
    });
  }

  const username = (process.env.SEED_ADMIN_USERNAME ?? "admin").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const superRole = await db.role.findUniqueOrThrow({ where: { key: "super_admin" } });
  const existing = await db.user.findUnique({ where: { username } });
  if (!existing) {
    if (!password) throw new Error("Set SEED_ADMIN_PASSWORD to create the first Super Admin.");
    await db.user.create({
      data: {
        username,
        fullName: "સુપર એડમિન",
        passwordHash: await bcrypt.hash(password, 12),
        mustChangePassword: true,
        roleId: superRole.id,
      },
    });
    console.log(`Created Super Admin "${username}" (must change password at first sign-in).`);
  }

  for (const [type, values] of Object.entries(MASTERS)) {
    for (const [i, value] of values.entries()) {
      await db.masterValue.upsert({
        where: { type_value: { type, value } },
        create: { type, value, sortOrder: i },
        update: {},
      });
    }
  }

  await seedSetup();
  if (process.env.SEED_DEMO === "1") await seedDemoAll(db);
  console.log("Seed complete.");
}

// Account heads, money accounts, facilities and rate card. Rates are examples to change under setup.
const HEADS: { type: string; nameGu: string; nameEn: string; systemKey?: string }[] = [
  { type: "INCOME", nameGu: "સામાન્ય દાન", nameEn: "General donation", systemKey: "donation_general" },
  { type: "INCOME", nameGu: "બાંધકામ ફંડ", nameEn: "Building fund" },
  { type: "INCOME", nameGu: "ભોજન / અન્નક્ષેત્ર દાન", nameEn: "Food donation" },
  { type: "INCOME", nameGu: "શિક્ષણ સહાય દાન", nameEn: "Education aid donation" },
  { type: "INCOME", nameGu: "વાડી ભાડા આવક", nameEn: "Wadi rent", systemKey: "booking_rent" },
  { type: "INCOME", nameGu: "નુકસાની વસૂલાત", nameEn: "Damage recovery", systemKey: "booking_damage" },
  { type: "INCOME", nameGu: "સભ્ય ફી", nameEn: "Membership fee" },
  { type: "INCOME", nameGu: "બેંક વ્યાજ", nameEn: "Bank interest" },
  { type: "INCOME", nameGu: "અન્ય આવક", nameEn: "Other income" },
  { type: "EXPENSE", nameGu: "લાઈટ બિલ", nameEn: "Electricity" },
  { type: "EXPENSE", nameGu: "પાણી બિલ", nameEn: "Water" },
  { type: "EXPENSE", nameGu: "પગાર", nameEn: "Salaries" },
  { type: "EXPENSE", nameGu: "રિપેરિંગ / મેન્ટેનન્સ", nameEn: "Repairs & maintenance" },
  { type: "EXPENSE", nameGu: "બાંધકામ ખર્ચ", nameEn: "Construction" },
  { type: "EXPENSE", nameGu: "ઉત્સવ / કાર્યક્રમ ખર્ચ", nameEn: "Events" },
  { type: "EXPENSE", nameGu: "સફાઈ ખર્ચ", nameEn: "Cleaning" },
  { type: "EXPENSE", nameGu: "વાસણ / સામાન ખરીદી", nameEn: "Utensils & supplies" },
  { type: "EXPENSE", nameGu: "ઓફિસ / સ્ટેશનરી", nameEn: "Office & stationery" },
  { type: "EXPENSE", nameGu: "શિક્ષણ સહાય ચુકવણી", nameEn: "Education aid paid" },
  { type: "EXPENSE", nameGu: "અન્ય ખર્ચ", nameEn: "Other expenses" },
];

async function seedSetup() {
  for (const [i, h] of HEADS.entries()) {
    const existing = h.systemKey
      ? await db.accountHead.findUnique({ where: { systemKey: h.systemKey } })
      : await db.accountHead.findUnique({ where: { type_nameGu: { type: h.type, nameGu: h.nameGu } } });
    if (!existing) await db.accountHead.create({ data: { ...h, sortOrder: i } });
  }
  const today = new Date();
  const fyStart = today.getUTCMonth() >= 3 ? today.getUTCFullYear() : today.getUTCFullYear() - 1;
  const openingDate = new Date(`${fyStart}-04-01T00:00:00Z`);
  if (!(await db.moneyAccount.count())) {
    await db.moneyAccount.create({ data: { kind: "CASH", name: "રોકડ", openingDate, sortOrder: 0 } });
    await db.moneyAccount.create({ data: { kind: "BANK", name: "મુખ્ય બેંક ખાતું", bankDetails: "બેંકનું નામ અને ખાતા નં. અહીં લખો", openingDate, sortOrder: 1 } });
  }
  if (!(await db.facility.count())) {
    await db.facility.createMany({
      data: [
        { nameGu: "વાડી હોલ", nameEn: "Wadi hall", memberRate: 15000, nonMemberRate: 20000, deposit: 5000, sortOrder: 0 },
        { nameGu: "રસોડું", nameEn: "Kitchen", memberRate: 3000, nonMemberRate: 4000, deposit: 1000, sortOrder: 1 },
        { nameGu: "ઉપરનો હોલ", nameEn: "Upper hall", memberRate: 5000, nonMemberRate: 7000, deposit: 2000, sortOrder: 2 },
      ],
    });
  }
  if (!(await db.chargeItem.count())) {
    await db.chargeItem.createMany({
      data: [
        { nameGu: "વાસણ સેટ (100 વ્યક્તિ)", unit: "સેટ", rate: 400, sortOrder: 0 },
        { nameGu: "ગેસ", unit: "બાટલો", rate: 1100, sortOrder: 1 },
        { nameGu: "લાઈટ / સફાઈ ચાર્જ", unit: "દિવસ", rate: 1500, sortOrder: 2 },
        { nameGu: "વધારાની ખુરશી", unit: "નંગ", rate: 5, sortOrder: 3 },
        { nameGu: "AC ચાર્જ", unit: "દિવસ", rate: 2000, sortOrder: 4 },
      ],
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

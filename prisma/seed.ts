// Creates the starting roles, the first Super Admin, and the pick-lists.
// Safe to run more than once. With SEED_DEMO=1 it also adds a few clearly fictional
// families for the committee's test site (never run that on the live database).
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_ROLES } from "../src/lib/permissions";

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

  if (process.env.SEED_DEMO === "1") await seedDemo();
  console.log("Seed complete.");
}

// Fictional sample families for demos. Mobile numbers use the 90000 000xx range.
async function seedDemo() {
  if ((await db.family.count()) > 0) {
    console.log("Families already exist, skipping demo data.");
    return;
  }
  const demo = [
    { area: "મધુરម", vatan: "વંથલી", m: [["રમેશભાઈ", "મોહનભાઈ", "પરમાર", "સ્વયં", "M", "1971-03-12", "9000000010", "B+", "ધો. 12", "કોન્ટ્રાક્ટર", "પરિણીત"], ["ગીતાબેન", "રમેશભાઈ", "પરમાર", "પત્ની", "F", "1974-08-05", "", "O+", "ધો. 10", "ગૃહિણી", "પરિણીત"], ["હાર્દિક", "રમેશભાઈ", "પરમાર", "પુત્ર", "M", "1998-01-21", "9000000031", "B+", "B.E.", "એન્જિનિયર", "અપરિણીત"]] },
    { area: "ઝાંઝરડા રોડ", vatan: "કેશોદ", m: [["જયેશભાઈ", "કાનજીભાઈ", "ચૌહાણ", "સ્વયં", "M", "1968-11-02", "9000000045", "A+", "ધો. 10", "વેપાર", "પરિણીત"], ["મીનાબેન", "જયેશભાઈ", "ચૌહાણ", "પત્ની", "F", "1972-06-17", "", "A+", "ધો. 10", "ગૃહિણી", "પરિણીત"]] },
    { area: "ટીંબાવાડી", vatan: "માણાવદર", m: [["ભાવનાબેન", "દિનેશભાઈ", "ટાંક", "સ્વયં", "F", "1979-04-09", "9000000008", "O-", "સ્નાતક", "શિક્ષક", "વિધવા"], ["કૃણાલ", "દિનેશભાઈ", "ટાંક", "પુત્ર", "M", "2004-09-30", "9000000009", "O+", "ધો. 12", "અભ્યાસ", "અપરિણીત"]] },
    { area: "મધુરમ", vatan: "વિસાવદર", m: [["વિનોદભાઈ", "બાબુભાઈ", "રાઠોડ", "સ્વયં", "M", "1960-01-15", "9000000077", "AB+", "પ્રાથમિક", "કડિયા કામ", "પરિણીત"], ["શારદાબેન", "વિનોદભાઈ", "રાઠોડ", "પત્ની", "F", "1963-02-20", "", "B+", "પ્રાથમિક", "ગૃહિણી", "પરિણીત"], ["અલ્પેશ", "વિનોદભાઈ", "રાઠોડ", "પુત્ર", "M", "1987-07-07", "9000000078", "AB+", "ITI", "બિલ્ડર", "પરિણીત"], ["નિશા", "અલ્પેશભાઈ", "રાઠોડ", "પુત્રવધૂ", "F", "1990-12-01", "", "A-", "સ્નાતક", "ગૃહિણી", "પરિણીત"]] },
  ];
  let n = 0;
  for (const f of demo) {
    n += 1;
    await db.$transaction(async (tx) => {
      const c = await tx.counter.upsert({ where: { key: "family" }, create: { key: "family", value: 1 }, update: { value: { increment: 1 } } });
      const familyNo = `M-${String(c.value).padStart(5, "0")}`;
      await tx.family.create({
        data: {
          familyNo,
          area: f.area,
          vatan: f.vatan,
          address: `નમૂનો સરનામું ${n}, જુનાગઢ`,
          notes: "DEMO — નમૂનાની વિગત",
          members: {
            create: f.m.map((r, i) => ({
              isHead: i === 0,
              sortOrder: i,
              firstName: r[0],
              fatherName: r[1],
              surname: r[2],
              relation: r[3],
              gender: r[4],
              dob: new Date(`${r[5]}T00:00:00Z`),
              mobile: r[6] || null,
              bloodGroup: r[7],
              education: r[8],
              occupation: r[9],
              maritalStatus: r[10],
            })),
          },
        },
      });
    });
  }
  console.log(`Added ${demo.length} demo families.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

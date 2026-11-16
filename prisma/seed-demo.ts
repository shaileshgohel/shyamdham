// Clearly fictional demo data for the committee's test site: users for every role, trust
// details, sample families, a year of receipts and expenses, bookings in every state,
// stock history and matching audit entries. Run with SEED_DEMO=1 npm run db:seed.
// Never run on the live database. Every section skips itself when its data already exists.
import { Prisma, type PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

type Db = PrismaClient;
type Actor = { id: number; fullName: string };

const D = (n: number) => new Prisma.Decimal(n.toFixed(2));
const today = new Date();
/** Calendar date `offset` days from today (negative = past), as the UTC midnight the app stores. */
const day = (offset: number) => new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + offset));
const fyOf = (d: Date) => {
  const y = d.getUTCMonth() >= 3 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
  return `${String(y % 100).padStart(2, "0")}-${String((y + 1) % 100).padStart(2, "0")}`;
};
const fmt = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const DEVICE = "PC · Mac · Chrome";
const IP = "192.168.1.25";
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "Demo@1234";

// Document numbers restart every financial year, like src/lib/accounts.ts.
async function next(db: Db, prefix: string, d: Date) {
  const key = `${prefix}:${fyOf(d)}`;
  const c = await db.counter.upsert({ where: { key }, create: { key, value: 1 }, update: { value: { increment: 1 } } });
  return `${prefix}/${fyOf(d)}/${String(c.value).padStart(4, "0")}`;
}

let logMinute = 0;
async function log(db: Db, actor: Actor | null, d: Date, action: string, entity: string, entityId: number | string | null, docNo: string | null, summary: string, changes?: Record<string, [unknown, unknown]>) {
  // 10:30 IST plus a few minutes per entry, so entries on the same day keep their order.
  const at = new Date(d.getTime() + 5 * 3600_000 + (logMinute++ % 300) * 60_000);
  await db.auditLog.create({
    data: { at, userId: actor?.id ?? null, userName: actor?.fullName ?? "—", action, entity, entityId: entityId == null ? null : String(entityId), docNo, summary, changes: changes as Prisma.InputJsonValue | undefined, ip: IP, device: DEVICE },
  });
}

export async function seedDemoAll(db: Db) {
  const admin = await db.user.findFirstOrThrow({ where: { role: { isSuperAdmin: true } }, orderBy: { id: "asc" } });
  const users = await seedUsers(db, admin);
  await seedSettings(db, admin);
  await seedFamilies(db, admin, users.clerk);
  await seedLedger(db, admin, users);
  await seedStock(db, users.store);
  await seedBookings(db, users);
  await seedActivity(db, admin, users);
}

// ---------- Users: one per role, so every screen can be tried with that role's rights ----------

const DEMO_USERS = [
  { username: "trustee", fullName: "હસમુખભાઈ પરમાર", role: "trustee", mobile: "9000000201" },
  { username: "accountant", fullName: "કિરણભાઈ ચૌહાણ", role: "accountant", mobile: "9000000202" },
  { username: "clerk", fullName: "નીતાબેન ટાંક", role: "receipt_clerk", mobile: "9000000203" },
  { username: "wadi", fullName: "મહેશભાઈ રાઠોડ", role: "wadi_manager", mobile: "9000000204" },
  { username: "store", fullName: "સુરેશભાઈ સોલંકી", role: "store_keeper", mobile: "9000000205" },
  { username: "oldclerk", fullName: "જૂના ક્લાર્ક (બંધ)", role: "receipt_clerk", mobile: null, inactive: true },
] as const;

async function seedUsers(db: Db, admin: Actor) {
  const hash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const out: Record<string, Actor> = {};
  let created = 0;
  for (const [i, u] of DEMO_USERS.entries()) {
    const role = await db.role.findUniqueOrThrow({ where: { key: u.role } });
    let row = await db.user.findUnique({ where: { username: u.username } });
    if (!row) {
      const inactive = "inactive" in u && u.inactive;
      row = await db.user.create({
        data: { username: u.username, fullName: u.fullName, mobile: u.mobile, passwordHash: hash, mustChangePassword: false, isActive: !inactive, roleId: role.id, lastLoginAt: inactive ? day(-200) : day(-i) },
      });
      await log(db, admin, day(-180 + i), "create", "user", row.id, u.username, `નવો વપરાશકર્તા: ${u.fullName} (${role.nameGu})`);
      if (inactive) await log(db, admin, day(-150), "edit", "user", row.id, u.username, `વપરાશકર્તા બંધ કર્યો: ${u.fullName}`, { ચાલુ: [true, false] });
      created++;
    }
    out[u.username] = { id: row.id, fullName: row.fullName };
  }
  if (created) console.log(`Added ${created} demo users (password in SEED_DEMO_PASSWORD, default in prisma/seed-demo.ts).`);
  return out;
}

// ---------- Trust details printed on receipts and bills ----------

async function seedSettings(db: Db, admin: Actor) {
  if (await db.setting.count()) return;
  const values: Record<string, string> = {
    trust_name: "શ્યામધામ મધુરમ",
    trust_sub: "શ્રી કડિયા જ્ઞાતિ સમાજ ટ્રસ્ટ, જુનાગઢ",
    address: "મધુરમ સોસાયટી, ઝાંઝરડા રોડ, જુનાગઢ – 362001",
    phone: "0285 2650000 · 90000 00200",
    reg_no: "E/1234/જુનાગઢ (નમૂનો)",
    pan: "DEMOT0000A",
    g80_text: "80G માન્યતા નં. DEMO/80G/2026, તા. 01-04-2026 થી (નમૂનો) — આ દાન આવકવેરા કલમ 80G હેઠળ કપાતપાત્ર છે.",
    receipt_footer: "આપના ઉદાર દાન બદલ સંસ્થા આપની આભારી છે. જય શ્રી કૃષ્ણ.",
    bill_terms: "ડિપોઝિટ પ્રસંગ પછી વસ્તુઓ તપાસીને પરત આપવામાં આવશે. નુકસાન કે ખૂટતી વસ્તુનો ચાર્જ ડિપોઝિટમાંથી કાપવામાં આવશે. હોલ સવારે 8 થી રાત્રે 11 સુધી ઉપલબ્ધ રહેશે.",
  };
  for (const [key, value] of Object.entries(values)) await db.setting.create({ data: { key, value } });
  await log(db, admin, day(-170), "edit", "setting", null, null, "સંસ્થાની વિગતો સુધારી (નામ, સરનામું, PAN, 80G)");
  console.log("Added demo trust details.");
}

// ---------- Families: mobile numbers use the 90000 000xx range ----------

type M = [first: string, father: string, surname: string, relation: string, gender: string, dob: string, mobile: string, blood: string, edu: string, occ: string, marital: string, extra?: { pan?: string; email?: string; isAlive?: false }];
type F = { area: string; vatan: string; membershipType?: string; address: string; isActive?: false; notes?: string; m: M[] };

const FAMILIES: F[] = [
  { area: "મધુરમ", vatan: "વંથલી", membershipType: "આજીવન", address: "12, મધુરમ સોસાયટી, ઝાંઝરડા રોડ", m: [["રમેશભાઈ", "મોહનભાઈ", "પરમાર", "સ્વયં", "M", "1971-03-12", "9000000010", "B+", "ધો. 12", "કોન્ટ્રાક્ટર", "પરિણીત", { pan: "DEMOP0010A" }], ["ગીતાબેન", "રમેશભાઈ", "પરમાર", "પત્ની", "F", "1974-08-05", "", "O+", "ધો. 10", "ગૃહિણી", "પરિણીત"], ["હાર્દિક", "રમેશભાઈ", "પરમાર", "પુત્ર", "M", "1998-01-21", "9000000031", "B+", "B.E.", "એન્જિનિયર", "અપરિણીત", { email: "hardik.demo@example.com" }]] },
  { area: "ઝાંઝરડા રોડ", vatan: "કેશોદ", address: "શિવમ પાર્ક, શેરી નં. 3", m: [["જયેશભાઈ", "કાનજીભાઈ", "ચૌહાણ", "સ્વયં", "M", "1968-11-02", "9000000045", "A+", "ધો. 10", "વેપાર", "પરિણીત"], ["મીનાબેન", "જયેશભાઈ", "ચૌહાણ", "પત્ની", "F", "1972-06-17", "", "A+", "ધો. 10", "ગૃહિણી", "પરિણીત"], ["કિંજલ", "જયેશભાઈ", "ચૌહાણ", "પુત્રી", "F", "2001-04-11", "9000000046", "A+", "સ્નાતક", "નોકરી", "અપરિણીત"]] },
  { area: "ટીંબાવાડી", vatan: "માણાવદર", address: "ગાયત્રી નગર, ટીંબાવાડી", m: [["ભાવનાબેન", "દિનેશભાઈ", "ટાંક", "સ્વયં", "F", "1979-04-09", "9000000008", "O-", "સ્નાતક", "શિક્ષક", "વિધવા"], ["કૃણાલ", "દિનેશભાઈ", "ટાંક", "પુત્ર", "M", "2004-09-30", "9000000009", "O+", "ધો. 12", "અભ્યાસ", "અપરિણીત"]] },
  { area: "મધુરમ", vatan: "વિસાવદર", membershipType: "આજીવન", address: "7, મધુરમ સોસાયટી", m: [["વિનોદભાઈ", "બાબુભાઈ", "રાઠોડ", "સ્વયં", "M", "1960-01-15", "9000000077", "AB+", "પ્રાથમિક", "કડિયા કામ", "પરિણીત"], ["શારદાબેન", "વિનોદભાઈ", "રાઠોડ", "પત્ની", "F", "1963-02-20", "", "B+", "પ્રાથમિક", "ગૃહિણી", "પરિણીત"], ["અલ્પેશ", "વિનોદભાઈ", "રાઠોડ", "પુત્ર", "M", "1987-07-07", "9000000078", "AB+", "ITI", "બિલ્ડર", "પરિણીત"], ["નિશા", "અલ્પેશભાઈ", "રાઠોડ", "પુત્રવધૂ", "F", "1990-12-01", "", "A-", "સ્નાતક", "ગૃહિણી", "પરિણીત"]] },
  { area: "મોતીબાગ", vatan: "માંગરોળ", membershipType: "આજીવન", address: "રાધે કૃષ્ણ બંગલોઝ, મોતીબાગ", m: [["સુરેશભાઈ", "રામજીભાઈ", "સોલંકી", "સ્વયં", "M", "1965-05-20", "9000000101", "O+", "ધો. 10", "બિલ્ડર", "પરિણીત", { pan: "DEMOP0101S" }], ["કમળાબેન", "સુરેશભાઈ", "સોલંકી", "પત્ની", "F", "1968-09-14", "", "B+", "પ્રાથમિક", "ગૃહિણી", "પરિણીત"], ["રાહુલ", "સુરેશભાઈ", "સોલંકી", "પુત્ર", "M", "1992-02-28", "9000000102", "O+", "ડિપ્લોમા", "બિલ્ડર", "પરિણીત"], ["પૂજા", "રાહુલભાઈ", "સોલંકી", "પુત્રવધૂ", "F", "1995-07-19", "", "A+", "સ્નાતક", "ગૃહિણી", "પરિણીત"], ["આર્યન", "રાહુલભાઈ", "સોલંકી", "પૌત્ર", "M", "2018-10-02", "", "O+", "", "અભ્યાસ", "અપરિણીત"]] },
  { area: "ગાંધીગ્રામ", vatan: "મેંદરડા", address: "સરદાર ચોક, ગાંધીગ્રામ", m: [["દિલીપભાઈ", "નાથાભાઈ", "વાઘેલા", "સ્વયં", "M", "1975-12-03", "9000000111", "B-", "ITI", "કોન્ટ્રાક્ટર", "પરિણીત"], ["રેખાબેન", "દિલીપભાઈ", "વાઘેલા", "પત્ની", "F", "1979-03-25", "9000000112", "B+", "ધો. 12", "ગૃહિણી", "પરિણીત"], ["ક્રિષ્ના", "દિલીપભાઈ", "વાઘેલા", "પુત્રી", "F", "2003-08-08", "", "B-", "ધો. 12", "અભ્યાસ", "અપરિણીત"], ["દેવ", "દિલીપભાઈ", "વાઘેલા", "પુત્ર", "M", "2007-01-30", "", "B+", "ધો. 10", "અભ્યાસ", "અપરિણીત"]] },
  { area: "જોષીપરા", vatan: "ભેસાણ", address: "આનંદ વિલા, જોષીપરા", m: [["મનીષભાઈ", "હરજીભાઈ", "મકવાણા", "સ્વયં", "M", "1983-06-21", "9000000121", "A+", "B.E.", "એન્જિનિયર", "પરિણીત", { email: "manish.demo@example.com", pan: "DEMOP0121M" }], ["હેતલબેન", "મનીષભાઈ", "મકવાણા", "પત્ની", "F", "1986-11-11", "9000000122", "O+", "અનુસ્નાતક", "શિક્ષક", "પરિણીત"], ["રિયા", "મનીષભાઈ", "મકવાણા", "પુત્રી", "F", "2012-05-05", "", "A+", "પ્રાથમિક", "અભ્યાસ", "અપરિણીત"]] },
  { area: "દોલતપરા", vatan: "બિલખા", membershipType: "આજીવન", address: "જૂનું ગામ, દોલતપરા", m: [["અમૃતભાઈ", "લાલજીભાઈ", "ગોહિલ", "સ્વયં", "M", "1952-02-14", "9000000131", "O+", "પ્રાથમિક", "નિવૃત્ત", "પરિણીત"], ["લાલજીભાઈ", "જીવાભાઈ", "ગોહિલ", "પિતા", "M", "1928-01-01", "", "", "", "નિવૃત્ત", "વિધુર", { isAlive: false }], ["મંજુલાબેન", "અમૃતભાઈ", "ગોહિલ", "પત્ની", "F", "1956-04-30", "", "AB+", "પ્રાથમિક", "ગૃહિણી", "પરિણીત"], ["પ્રકાશ", "અમૃતભાઈ", "ગોહિલ", "પુત્ર", "M", "1980-09-09", "9000000132", "O+", "ધો. 12", "સરકારી નોકરી", "પરિણીત"]] },
  { area: "બસ સ્ટેન્ડ વિસ્તાર", vatan: "જુનાગઢ", address: "ડૉક્ટર હાઉસ, બસ સ્ટેન્ડ પાસે", m: [["ડૉ. જ્યોતિબેન", "નરેશભાઈ", "ડાભી", "સ્વયં", "F", "1980-10-10", "9000000141", "A-", "MBBS", "ડોક્ટર", "પરિણીત", { pan: "DEMOP0141D" }], ["નિલેશભાઈ", "રમણભાઈ", "ડાભી", "પતિ", "M", "1978-07-22", "9000000142", "B+", "CA", "નોકરી", "પરિણીત"], ["વેદ", "નિલેશભાઈ", "ડાભી", "પુત્ર", "M", "2010-03-03", "", "A-", "પ્રાથમિક", "અભ્યાસ", "અપરિણીત"]] },
  { area: "ખલીલપુર રોડ", vatan: "માળિયા હાટીના", address: "ખલીલપુર રોડ (હવે રાજકોટ)", isActive: false, notes: "પરિવાર રાજકોટ સ્થળાંતર થયો — DEMO", m: [["કાંતિભાઈ", "ધીરુભાઈ", "પરમાર", "સ્વયં", "M", "1970-08-18", "9000000151", "O+", "ધો. 10", "વેપાર", "પરિણીત"], ["હંસાબેન", "કાંતિભાઈ", "પરમાર", "પત્ની", "F", "1973-01-26", "", "O+", "ધો. 10", "ગૃહિણી", "પરિણીત"]] },
];

async function seedFamilies(db: Db, admin: Actor, clerk: Actor) {
  let n = 0;
  for (const [i, f] of FAMILIES.entries()) {
    const head = f.m[0];
    if (await db.member.findFirst({ where: { isHead: true, mobile: head[6] } })) continue;
    const created = await db.$transaction(async (tx) => {
      const c = await tx.counter.upsert({ where: { key: "family" }, create: { key: "family", value: 1 }, update: { value: { increment: 1 } } });
      const familyNo = `M-${String(c.value).padStart(5, "0")}`;
      return tx.family.create({
        data: {
          familyNo, area: f.area, vatan: f.vatan, address: f.address, membershipType: f.membershipType ?? "સામાન્ય", isActive: f.isActive ?? true, notes: f.notes ?? "DEMO — નમૂનાની વિગત", createdById: admin.id,
          members: {
            create: f.m.map((r, j) => ({
              isHead: j === 0, sortOrder: j, firstName: r[0], fatherName: r[1], surname: r[2], relation: r[3], gender: r[4],
              dob: new Date(`${r[5]}T00:00:00Z`), mobile: r[6] || null, bloodGroup: r[7] || null, education: r[8] || null, occupation: r[9] || null, maritalStatus: r[10],
              pan: r[11]?.pan ?? null, email: r[11]?.email ?? null, isAlive: r[11]?.isAlive ?? true,
            })),
          },
        },
      });
    });
    n++;
    const who = i % 2 ? clerk : admin;
    await log(db, who, day(-160 + i * 9), "create", "family", created.id, created.familyNo, `નવો પરિવાર: ${head[0]} ${head[2]} · ${f.m.length} સભ્ય · ${f.area}`);
    if (f.isActive === false) await log(db, admin, day(-20), "cancel", "family", created.id, created.familyNo, `પરિવાર બંધ · કારણ: ${f.notes}`);
  }
  if (n) console.log(`Added ${n} demo families.`);
}

// ---------- Receipts, expenses and transfers across the year ----------

type Users = Record<string, Actor>;

async function seedLedger(db: Db, admin: Actor, users: Users) {
  if (await db.voucher.count()) return;
  const cash = await db.moneyAccount.findFirstOrThrow({ where: { kind: "CASH" } });
  const bank = await db.moneyAccount.findFirstOrThrow({ where: { kind: "BANK" } });
  // Opening balances so the cash book never goes negative in the demo.
  if (Number(cash.openingBalance) === 0) await db.moneyAccount.update({ where: { id: cash.id }, data: { openingBalance: D(40000) } });
  if (Number(bank.openingBalance) === 0) await db.moneyAccount.update({ where: { id: bank.id }, data: { openingBalance: D(250000), bankDetails: "બેંક ઓફ બરોડા, ઝાંઝરડા રોડ શાખા · ખાતા નં. ****1234" } });
  const head = (n: string) => db.accountHead.findFirstOrThrow({ where: { nameGu: n } });
  const acctFor = (mode: string) => (mode === "CASH" ? cash : bank);
  const heads = await db.member.findMany({ where: { isHead: true, family: { isActive: true } }, include: { family: true }, orderBy: { id: "asc" } });
  const clerk = users.clerk ?? admin;
  const accountant = users.accountant ?? admin;

  // [days ago, head, amount, mode, donor index into heads (or name), reference, in memory of, cancelled?]
  const gifts: [number, string, number, string, number | string, string | null, string | null, boolean?][] = [
    [150, "બાંધકામ ફંડ", 51000, "CHEQUE", 0, "ચેક નં. 004512", "સ્વ. મોહનભાઈ પરમાર"],
    [120, "સામાન્ય દાન", 5100, "CASH", 1, null, null],
    [95, "શિક્ષણ સહાય દાન", 25000, "BANK", 4, "UTR DEMO2026095", null],
    [70, "ભોજન / અન્નક્ષેત્ર દાન", 11000, "UPI", 6, "UPI 2026070001", "સ્વ. હરજીભાઈ મકવાણા"],
    [45, "સામાન્ય દાન", 2100, "CASH", "શ્રી જયંતિભાઈ વાઘેલા (મુંબઈ)", null, null],
    [30, "બાંધકામ ફંડ", 21000, "UPI", 7, "UPI 2026030002", null],
    [20, "સભ્ય ફી", 1100, "CASH", 5, null, null],
    [12, "ભોજન / અન્નક્ષેત્ર દાન", 5100, "CASH", 2, null, null, true],
    [12, "ભોજન / અન્નક્ષેત્ર દાન", 5100, "CASH", 2, null, null],
    [6, "સામાન્ય દાન", 1100, "UPI", 8, "UPI 2026006003", null],
    [1, "બાંધકામ ફંડ", 11000, "CASH", 3, null, null],
    [0, "સામાન્ય દાન", 2100, "CASH", 1, null, null],
  ];
  for (const [ago, headName, amount, mode, donor, reference, inMemoryOf, cancelled] of gifts) {
    const d = day(-ago);
    const h = typeof donor === "number" ? heads[donor % heads.length] : null;
    const donorName = h ? `${h.firstName} ${h.fatherName ?? ""} ${h.surname}`.replace(/\s+/g, " ") : String(donor);
    const receiptNo = await next(db, "SD", d);
    const hd = await head(headName);
    const acct = acctFor(mode);
    const cancel = cancelled ? { status: "CANCELLED", cancelReason: "ભૂલથી બે વાર રસીદ બની", cancelledAt: new Date(d.getTime() + 6 * 3600_000), cancelledById: admin.id } : {};
    const donation = await db.donation.create({
      data: {
        receiptNo, fy: fyOf(d), date: d, donorName, familyId: h?.familyId, mobile: h?.mobile, address: h?.family.address, pan: h?.pan, headId: hd.id, amount: D(amount), mode, reference, accountId: acct.id, inMemoryOf,
        notes: "DEMO", verifyCode: randomBytes(9).toString("base64url"), createdById: clerk.id, createdByName: clerk.fullName, ...cancel,
      },
    });
    await db.voucher.create({
      data: { voucherNo: receiptNo, date: d, type: "INCOME", headId: hd.id, accountId: acct.id, amount: D(amount), mode, reference, party: donorName, source: "DONATION", donationId: donation.id, narration: inMemoryOf ? `${inMemoryOf} ની સ્મૃતિમાં` : null, createdById: clerk.id, createdByName: clerk.fullName, ...cancel },
    });
    await log(db, clerk, d, "create", "donation", donation.id, receiptNo, `દાન રસીદ: ${donorName} · ${inr(amount)} · ${headName}`);
    if (cancelled) await log(db, admin, d, "cancel", "donation", donation.id, receiptNo, `રસીદ રદ · કારણ: ભૂલથી બે વાર રસીદ બની`);
  }

  // [days ago, head, amount, mode, paid to, reference, narration]
  const spends: [number, string, number, string, string, string | null, string][] = [
    [140, "પગાર", 12000, "BANK", "વાડી કેરટેકર", "NEFT DEMO140", "જૂન મહિનાનો પગાર"],
    [110, "લાઈટ બિલ", 8450, "BANK", "PGVCL", "બિલ નં. 55012", "જુલાઈ લાઈટ બિલ"],
    [100, "સફાઈ ખર્ચ", 1500, "CASH", "સફાઈ કામદાર", null, "હોલ અને વાડી સફાઈ"],
    [80, "પગાર", 12000, "BANK", "વાડી કેરટેકર", "NEFT DEMO080", "ઓગસ્ટ મહિનાનો પગાર"],
    [75, "રિપેરિંગ / મેન્ટેનન્સ", 6500, "CASH", "નમૂનો પ્લમ્બર", null, "રસોડાની પાણીની લાઈન રિપેર"],
    [60, "ઓફિસ / સ્ટેશનરી", 850, "CASH", "નમૂનો સ્ટેશનરી સ્ટોર", null, "રસીદ બુક અને રજિસ્ટર"],
    [50, "પગાર", 12000, "BANK", "વાડી કેરટેકર", "NEFT DEMO050", "સપ્ટેમ્બર મહિનાનો પગાર"],
    [40, "લાઈટ બિલ", 9120, "BANK", "PGVCL", "બિલ નં. 58230", "ઓક્ટોબર લાઈટ બિલ"],
    [25, "ઉત્સવ / કાર્યક્રમ ખર્ચ", 18500, "CASH", "જ્ઞાતિ ઉત્સવ સમિતિ", null, "શરદ પૂર્ણિમા ઉત્સવ — ભોજન અને મંડપ"],
    [20, "પગાર", 12000, "BANK", "વાડી કેરટેકર", "NEFT DEMO020", "ઓક્ટોબર મહિનાનો પગાર"],
    [9, "વાસણ / સામાન ખરીદી", 7200, "CASH", "નમૂનો સ્ટીલ ભંડાર", null, "100 સ્ટીલ થાળી"],
    [3, "પાણી બિલ", 1340, "BANK", "જુનાગઢ મહાનગરપાલિકા", "ઓનલાઈન", "પાણી વેરો"],
    [0, "સફાઈ ખર્ચ", 500, "CASH", "સફાઈ કામદાર", null, "આજની સફાઈ"],
  ];
  for (const [ago, headName, amount, mode, party, reference, narration] of spends) {
    const d = day(-ago);
    const hd = await head(headName);
    const no = await next(db, "JV", d);
    const v = await db.voucher.create({ data: { voucherNo: no, date: d, type: "EXPENSE", headId: hd.id, accountId: acctFor(mode).id, amount: D(amount), mode, reference, party, narration: `${narration} (DEMO)`, createdById: accountant.id, createdByName: accountant.fullName } });
    await log(db, accountant, d, "create", "voucher", v.id, no, `જાવક: ${party} · ${inr(amount)} · ${headName}`);
  }

  // Transfers between cash and bank.
  const contra: [number, "cash" | "bank", number, string][] = [[115, "cash", 25000, "રોકડ બેંકમાં જમા"], [35, "bank", 10000, "ઉત્સવ માટે બેંકમાંથી રોકડ ઉપાડ"]];
  for (const [ago, from, amount, narration] of contra) {
    const d = day(-ago);
    const no = await next(db, "CT", d);
    const v = await db.voucher.create({ data: { voucherNo: no, date: d, type: "CONTRA", accountId: from === "cash" ? cash.id : bank.id, toAccountId: from === "cash" ? bank.id : cash.id, amount: D(amount), mode: from === "cash" ? "CASH" : "BANK", reference: from === "cash" ? "પે-ઇન સ્લિપ" : "ચેક નં. 004520", narration: `${narration} (DEMO)`, createdById: accountant.id, createdByName: accountant.fullName } });
    await log(db, accountant, d, "create", "voucher", v.id, no, `ખાતાફેર: ${narration} · ${inr(amount)}`);
  }
  // Bank interest credited.
  const dInt = day(-48);
  const intNo = await next(db, "AV", dInt);
  await db.voucher.create({ data: { voucherNo: intNo, date: dInt, type: "INCOME", headId: (await head("બેંક વ્યાજ")).id, accountId: bank.id, amount: D(2875), mode: "BANK", reference: "બેંક સ્ટેટમેન્ટ", party: "બેંક ઓફ બરોડા", narration: "ત્રિમાસિક બચત વ્યાજ (DEMO)", createdById: accountant.id, createdByName: accountant.fullName } });
  await log(db, accountant, dInt, "create", "voucher", null, intNo, "આવક: બેંક વ્યાજ · ₹2,875");
  console.log("Added demo receipts, expenses and transfers.");
}

// ---------- Inventory with a history of movements ----------

async function seedStock(db: Db, store: Actor) {
  if (await db.item.count()) return;
  // [name, category, location, opening qty, min qty, charge per piece, unit, notes]
  const items: [string, string, string, number, number, number, string, string?][] = [
    ["સ્ટીલ થાળી", "વાસણ", "સ્ટોર રૂમ 1", 1000, 100, 60, "નંગ"],
    ["સ્ટીલ વાટકી", "વાસણ", "સ્ટોર રૂમ 1", 1500, 150, 25, "નંગ"],
    ["સ્ટીલ ગ્લાસ", "વાસણ", "સ્ટોર રૂમ 1", 1200, 100, 20, "નંગ"],
    ["ચમચી", "વાસણ", "સ્ટોર રૂમ 1", 800, 100, 5, "નંગ"],
    ["મોટું તપેલું (50 લિ.)", "રસોડું", "રસોડું", 12, 2, 2500, "નંગ"],
    ["કડાઈ (મોટી)", "રસોડું", "રસોડું", 6, 1, 1800, "નંગ"],
    ["ગેસ બાટલો (કોમર્શિયલ)", "રસોડું", "રસોડું", 2, 3, 0, "નંગ", "ખાલી બાટલા બદલાવવાના બાકી"],
    ["પ્લાસ્ટિક ખુરશી", "ફર્નિચર", "હોલ", 600, 50, 350, "નંગ"],
    ["ફોલ્ડિંગ ટેબલ", "ફર્નિચર", "હોલ", 40, 5, 1500, "નંગ"],
    ["ગાદલા", "બિછાત", "સ્ટોર રૂમ 2", 150, 20, 900, "નંગ"],
    ["ચાદર", "બિછાત", "સ્ટોર રૂમ 2", 200, 30, 250, "નંગ"],
    ["સાઉન્ડ સિસ્ટમ", "ઇલેક્ટ્રિક / સાઉન્ડ", "ઓફિસ", 2, 1, 0, "સેટ"],
    ["LED લાઈટ સિરીઝ", "સજાવટ", "સ્ટોર રૂમ 2", 25, 5, 400, "નંગ"],
    ["મંડપ કાપડ", "સજાવટ", "સ્ટોર રૂમ 2", 10, 2, 1200, "થાન"],
  ];
  const byName: Record<string, number> = {};
  for (const [nameGu, category, location, qty, minQty, chargeRate, unit, notes] of items) {
    const it = await db.item.create({ data: { nameGu, category, location, minQty, chargeRate: D(chargeRate), unit, notes: notes ?? null } });
    byName[nameGu] = it.id;
    await db.stockMovement.create({ data: { itemId: it.id, date: day(-200), type: "PURCHASE", qty, notes: "શરૂઆતનો સ્ટોક (DEMO)", createdById: store.id, createdByName: store.fullName } });
    await log(db, store, day(-200), "create", "item", it.id, nameGu, `નવી વસ્તુ: ${nameGu} · ${qty} ${unit}`);
  }
  const mv = async (name: string, ago: number, type: string, qty: number, notes: string) => {
    const m = await db.stockMovement.create({ data: { itemId: byName[name], date: day(-ago), type, qty, notes: `${notes} (DEMO)`, createdById: store.id, createdByName: store.fullName } });
    await log(db, store, day(-ago), "create", "stock", m.id, name, `સ્ટોક: ${name} · ${type} ${qty}`);
  };
  await mv("સ્ટીલ થાળી", 90, "ADJUST", -12, "ગણતરીમાં 12 ઓછી મળી");
  await mv("સ્ટીલ થાળી", 9, "PURCHASE", 100, "નવી ખરીદી — JV બિલ જુઓ");
  await mv("પ્લાસ્ટિક ખુરશી", 60, "DAMAGED", 20, "ચોમાસામાં તૂટેલી");
  await mv("પ્લાસ્ટિક ખુરશી", 38, "WRITE_OFF", 8, "રિપેર ન થઈ શકે તેવી");
  await mv("મોટું તપેલું (50 લિ.)", 50, "DAMAGED", 2, "કાણું પડ્યું");
  await mv("મોટું તપેલું (50 લિ.)", 42, "REPAIRED", 1, "વેલ્ડિંગ કરાવ્યું");
  await mv("ગાદલા", 30, "DAMAGED", 6, "ફાટેલા");
  await mv("LED લાઈટ સિરીઝ", 15, "ADJUST", -3, "ગણતરીમાં 3 ઓછી");
  console.log(`Added ${items.length} demo items with stock history.`);
}

// ---------- Bookings in every state, with payments, deposits, items and damage ----------

type Line = { kind: string; description: string; qty: number; rate: number; amount: number };

async function seedBookings(db: Db, users: Users) {
  if (await db.booking.count()) return;
  const wadi = users.wadi;
  const store = users.store;
  const cash = await db.moneyAccount.findFirstOrThrow({ where: { kind: "CASH" } });
  const bank = await db.moneyAccount.findFirstOrThrow({ where: { kind: "BANK" } });
  const rentHead = await db.accountHead.findUniqueOrThrow({ where: { systemKey: "booking_rent" } });
  const damageHead = await db.accountHead.findUniqueOrThrow({ where: { systemKey: "booking_damage" } });
  const facilities = await db.facility.findMany({ orderBy: { sortOrder: "asc" } });
  const fac = (nameGu: string) => facilities.find((f) => f.nameGu === nameGu) ?? facilities[0];
  const extras = await db.chargeItem.findMany();
  const extra = (nameGu: string) => extras.find((e) => e.nameGu === nameGu) ?? extras[0];
  const items = await db.item.findMany();
  const item = (nameGu: string) => items.find((i) => i.nameGu === nameGu) ?? items[0];
  const heads = await db.member.findMany({ where: { isHead: true, family: { isActive: true } }, include: { family: true }, orderBy: { id: "asc" } });
  const nameOf = (h: (typeof heads)[number]) => `${h.firstName} ${h.fatherName ?? ""} ${h.surname}`.replace(/\s+/g, " ");

  type Spec = {
    hirer?: number; name?: string; mobile?: string; address?: string; event: string; from: number; to?: number; slot?: string; guests: number;
    facilities: string[]; extras: [string, number][]; discount?: [number, string]; deposit: number; status: "CONFIRMED" | "COMPLETED" | "CANCELLED"; createdAgo: number; notes?: string;
  };
  const specs: Spec[] = [
    { hirer: 0, event: "લગ્ન", from: -28, to: -27, guests: 400, facilities: ["વાડી હોલ", "રસોડું"], extras: [["વાસણ સેટ (100 વ્યક્તિ)", 4], ["ગેસ", 3], ["લાઈટ / સફાઈ ચાર્જ", 2], ["વધારાની ખુરશી", 200]], discount: [2000, "જ્ઞાતિ સભ્ય"], deposit: 6000, status: "COMPLETED", createdAgo: 60, notes: "હાર્દિકના લગ્ન" },
    { name: "શ્રીમતી રેખાબેન દવે", mobile: "9000000302", address: "સરદાર બાગ, જુનાગઢ", event: "જન્મદિવસ", from: -55, slot: "EVENING", guests: 80, facilities: ["ઉપરનો હોલ"], extras: [["AC ચાર્જ", 1]], deposit: 2000, status: "COMPLETED", createdAgo: 65 },
    { name: "નમૂનો ઇવેન્ટ્સ પ્રા. લિ.", mobile: "9000000303", address: "કાળવા ચોક, જુનાગઢ", event: "મીટિંગ / સભા", from: -12, guests: 200, facilities: ["વાડી હોલ"], extras: [["લાઈટ / સફાઈ ચાર્જ", 1]], deposit: 5000, status: "CANCELLED", createdAgo: 20 },
    { name: "શ્રી અશોકભાઈ જોષી", mobile: "9000000301", address: "ગાંધીગ્રામ, જુનાગઢ", event: "સગાઈ", from: 6, slot: "EVENING", guests: 150, facilities: ["વાડી હોલ"], extras: [["લાઈટ / સફાઈ ચાર્જ", 1], ["વધારાની ખુરશી", 100]], deposit: 5000, status: "CONFIRMED", createdAgo: 10 },
    { hirer: 2, event: "ધાર્મિક કાર્યક્રમ", from: 14, slot: "MORNING", guests: 60, facilities: ["ઉપરનો હોલ"], extras: [], deposit: 2000, status: "CONFIRMED", createdAgo: 5, notes: "સત્યનારાયણ કથા" },
    { hirer: 1, event: "લગ્ન", from: 35, to: 36, guests: 600, facilities: ["વાડી હોલ", "રસોડું", "ઉપરનો હોલ"], extras: [["વાસણ સેટ (100 વ્યક્તિ)", 6], ["ગેસ", 4], ["AC ચાર્જ", 2], ["લાઈટ / સફાઈ ચાર્જ", 2]], deposit: 8000, status: "CONFIRMED", createdAgo: 3, notes: "કિંજલના લગ્ન" },
    { hirer: 5, event: "બેસણું", from: 2, slot: "MORNING", guests: 120, facilities: ["વાડી હોલ"], extras: [["વધારાની ખુરશી", 50]], discount: [5000, "બેસણું — અડધો દર"], deposit: 0, status: "CONFIRMED", createdAgo: 1 },
  ];

  const pay = async (b: { id: number; bookingNo: string; hirerName: string }, type: "INCOME" | "DEPOSIT_IN" | "DEPOSIT_OUT", ago: number, amount: number, mode: string, reference: string | null, what: string, headId: number | null = null) => {
    const d = day(-ago);
    const series = type === "INCOME" ? "AV" : type === "DEPOSIT_IN" ? "DP" : "DR";
    const acct = mode === "CASH" || mode === "ADJUST" ? cash : bank;
    const v = await db.voucher.create({ data: { voucherNo: await next(db, series, d), date: d, type, headId, accountId: acct.id, amount: D(amount), mode, reference, party: b.hirerName, narration: `${b.bookingNo} · ${what}`, source: "BOOKING", bookingId: b.id, createdById: wadi.id, createdByName: wadi.fullName } });
    await log(db, wadi, d, type === "DEPOSIT_OUT" ? "edit" : "create", "booking", b.id, b.bookingNo, `${what}: ${inr(amount)} · ${v.voucherNo}`);
    return v;
  };

  for (const s of specs) {
    const h = s.hirer != null ? heads[s.hirer % heads.length] : null;
    const from = day(s.from), to = day(s.to ?? s.from);
    const days = (s.to ?? s.from) - s.from + 1;
    const isMember = !!h;
    const lines: Line[] = [];
    for (const fn of s.facilities) {
      const f = fac(fn);
      const rate = Number(isMember ? f.memberRate : f.nonMemberRate);
      lines.push({ kind: "FACILITY", description: `${f.nameGu} ભાડું (${isMember ? "સભ્ય" : "બિન-સભ્ય"} દર)`, qty: days, rate, amount: rate * days });
    }
    for (const [en, qty] of s.extras) {
      const e = extra(en);
      lines.push({ kind: "EXTRA", description: `${e.nameGu} (${e.unit})`, qty, rate: Number(e.rate), amount: Number(e.rate) * qty });
    }
    if (s.discount) lines.push({ kind: "DISCOUNT", description: `ડિસ્કાઉન્ટ: ${s.discount[1]}`, qty: 1, rate: -s.discount[0], amount: -s.discount[0] });
    const gross = lines.reduce((n, l) => n + l.amount, 0);
    const bookingNo = await next(db, "WB", from);
    const hirerName = h ? nameOf(h) : s.name!;
    const b = await db.booking.create({
      data: {
        bookingNo, fy: fyOf(from), hirerName, mobile: h?.mobile ?? s.mobile, address: h ? h.family.address : s.address, familyId: h?.familyId, isMember, eventType: s.event, fromDate: from, toDate: to, slot: s.slot ?? "FULL", guests: s.guests,
        notes: s.notes ? `${s.notes} (DEMO)` : "DEMO", depositAmount: D(s.deposit), status: s.status, createdById: wadi.id, createdByName: wadi.fullName, createdAt: day(-s.createdAgo),
        facilities: { create: s.facilities.map((fn) => ({ facilityId: fac(fn).id })) },
        lines: { create: lines.map((l, i) => ({ ...l, qty: D(l.qty), rate: D(l.rate), amount: D(l.amount), sortOrder: i })) },
      },
    });
    await log(db, wadi, day(-s.createdAgo), "create", "booking", b.id, bookingNo, `વાડી બુકિંગ: ${hirerName} · ${fmt(from)}${days > 1 ? `–${fmt(to)}` : ""} · ${s.facilities.join(", ")} · બિલ ${inr(gross)}`);

    if (s.status === "COMPLETED" && s.hirer === 0) {
      // Full story: deposit, advance, utensils out and back with damage, final payment, deposit adjusted and the rest refunded.
      await pay(b, "DEPOSIT_IN", 60, s.deposit, "CASH", null, "ડિપોઝિટ જમા");
      await pay(b, "INCOME", 30, 20000, "UPI", "UPI 2026030010", "બિલ પેટે", rentHead.id);
      const issued: [string, number][] = [["સ્ટીલ થાળી", 400], ["સ્ટીલ વાટકી", 400], ["સ્ટીલ ગ્લાસ", 400], ["મોટું તપેલું (50 લિ.)", 4], ["પ્લાસ્ટિક ખુરશી", 200]];
      for (const [n, q] of issued) await db.stockMovement.create({ data: { itemId: item(n).id, date: day(-29), type: "ISSUE", qty: q, bookingId: b.id, createdById: store.id, createdByName: store.fullName } });
      await log(db, store, day(-29), "create", "stock", b.id, bookingNo, `બુકિંગ માટે સામાન આપ્યો: ${issued.map(([n, q]) => `${n} ${q}`).join(", ")}`);
      // Returns: [item, good, damaged, missing]
      const returns: [string, number, number, number][] = [["સ્ટીલ થાળી", 390, 6, 4], ["સ્ટીલ વાટકી", 395, 0, 5], ["સ્ટીલ ગ્લાસ", 400, 0, 0], ["મોટું તપેલું (50 લિ.)", 4, 0, 0], ["પ્લાસ્ટિક ખુરશી", 196, 4, 0]];
      let order = lines.length;
      for (const [n, good, damaged, missing] of returns) {
        const it = item(n);
        const base = { itemId: it.id, date: day(-26), bookingId: b.id, createdById: store.id, createdByName: store.fullName };
        if (good) await db.stockMovement.create({ data: { ...base, type: "RETURN", qty: good } });
        if (damaged) await db.stockMovement.create({ data: { ...base, type: "RETURN_DAMAGED", qty: damaged } });
        if (missing) await db.stockMovement.create({ data: { ...base, type: "RETURN_MISSING", qty: missing } });
        const bad = damaged + missing;
        if (bad) {
          const parts = [damaged ? `${damaged} નુકસાન` : "", missing ? `${missing} ખૂટ્યાં` : ""].filter(Boolean).join(", ");
          await db.bookingLine.create({ data: { bookingId: b.id, kind: "DAMAGE", description: `${it.nameGu}: ${parts}`, qty: D(bad), rate: it.chargeRate, amount: D(bad * Number(it.chargeRate)), sortOrder: ++order } });
        }
      }
      await log(db, store, day(-26), "create", "stock", b.id, bookingNo, "સામાન પરત: થાળી 6 નુકસાન 4 ખૂટી, વાટકી 5 ખૂટી, ખુરશી 4 તૂટી · નુકસાની બિલમાં ઉમેરી");
      const total = (await db.bookingLine.findMany({ where: { bookingId: b.id } })).reduce((n, l) => n + Number(l.amount), 0);
      const balanceBefore = total - 20000;
      const adjust = Math.min(4000, s.deposit);
      await pay(b, "INCOME", 26, balanceBefore - adjust, "CASH", null, "બિલ પેટે (આખરી)", rentHead.id);
      await pay(b, "DEPOSIT_OUT", 25, adjust, "ADJUST", null, "ડિપોઝિટમાંથી બિલ સરભર");
      await pay(b, "INCOME", 25, adjust, "ADJUST", null, "ડિપોઝિટમાંથી સરભર (નુકસાની)", damageHead.id);
      await pay(b, "DEPOSIT_OUT", 25, s.deposit - adjust, "CASH", null, "ડિપોઝિટ પરત");
      await log(db, wadi, day(-25), "edit", "booking", b.id, bookingNo, "બુકિંગ પૂરું");
    } else if (s.status === "COMPLETED") {
      await pay(b, "DEPOSIT_IN", s.createdAgo, s.deposit, "CASH", null, "ડિપોઝિટ જમા");
      await pay(b, "INCOME", -s.from, gross, "CASH", null, "બિલ પેટે", rentHead.id);
      await pay(b, "DEPOSIT_OUT", -s.from - 1, s.deposit, "CASH", null, "ડિપોઝિટ પરત");
      await log(db, wadi, day(-s.from - 1), "edit", "booking", b.id, bookingNo, "બુકિંગ પૂરું");
    } else if (s.status === "CANCELLED") {
      await pay(b, "DEPOSIT_IN", s.createdAgo, s.deposit, "UPI", "UPI 2026020020", "ડિપોઝિટ જમા");
      await pay(b, "DEPOSIT_OUT", 15, s.deposit, "UPI", "UPI 2026015021", "ડિપોઝિટ પરત");
      const reason = "યજમાને પ્રસંગ મોકૂફ રાખ્યો";
      await db.booking.update({ where: { id: b.id }, data: { cancelReason: reason, cancelledAt: new Date(day(-15).getTime() + 7 * 3600_000) } });
      await log(db, wadi, day(-15), "cancel", "booking", b.id, bookingNo, `બુકિંગ રદ · કારણ: ${reason}`);
    } else if (s.hirer === 1) {
      await pay(b, "DEPOSIT_IN", 3, s.deposit, "CHEQUE", "ચેક નં. 112233", "ડિપોઝિટ જમા");
      await pay(b, "INCOME", 2, 25000, "BANK", "NEFT DEMO2026002", "બિલ પેટે (એડવાન્સ)", rentHead.id);
    } else if (s.deposit && s.from === 6) {
      await pay(b, "DEPOSIT_IN", 10, s.deposit, "UPI", "UPI 2026010030", "ડિપોઝિટ જમા");
    }
  }
  console.log(`Added ${specs.length} demo bookings.`);
}

// ---------- Sign-ins and exports, so the audit log looks lived-in ----------

async function seedActivity(db: Db, admin: Actor, users: Users) {
  if (await db.auditLog.count({ where: { action: "export" } })) return;
  const people = [admin, users.trustee, users.accountant, users.clerk, users.wadi, users.store].filter(Boolean);
  for (let ago = 14; ago >= 0; ago--) {
    for (const [i, p] of people.entries()) {
      if ((ago + i) % 3 === 0) await log(db, p, day(-ago), "login", "session", null, null, "લોગિન");
    }
  }
  await log(db, null, day(-4), "login_failed", "session", null, null, "ખોટો પાસવર્ડ (1/5) · વપરાશકર્તા: clerk");
  await log(db, users.trustee, day(-7), "export", "family", null, null, "સભ્ય યાદી Excel નિકાસ (112 હરોળ)");
  await log(db, users.accountant, day(-2), "export", "voucher", null, null, "રોજમેળ Excel નિકાસ");
  await log(db, admin, day(-1), "export", "audit_log", null, null, "ઓડિટ લોગ Excel નિકાસ");
  await log(db, users.clerk, day(-3), "edit", "family", null, "M-00002", "પરિવાર સુધાર્યો: જયેશભાઈ ચૌહાણ", { મોબાઈલ: ["9000000044", "9000000045"], વિસ્તાર: ["મધુરમ", "ઝાંઝરડા રોડ"] });
  console.log("Added demo sign-ins and exports to the audit log.");
}

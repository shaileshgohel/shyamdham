import { db } from "@/lib/db";

export async function bookingFormData() {
  const [facilities, charges] = await Promise.all([
    db.facility.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    db.chargeItem.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  return {
    facilities: facilities.map((f) => ({ id: f.id, name: f.nameGu, memberRate: Number(f.memberRate), nonMemberRate: Number(f.nonMemberRate), deposit: Number(f.deposit) })),
    charges: charges.map((c) => ({ id: c.id, name: c.nameGu, unit: c.unit, rate: Number(c.rate) })),
  };
}

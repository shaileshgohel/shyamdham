import "server-only";
import { Prisma } from "@prisma/client";
import { db, type Tx } from "./db";
import { dateOnly } from "./money";

export const SLOTS = ["FULL", "MORNING", "EVENING"] as const;
export const SLOT_GU: Record<string, string> = { FULL: "આખો દિવસ", MORNING: "સવાર", EVENING: "સાંજ" };
export const SLOT_EN: Record<string, string> = { FULL: "Full day", MORNING: "Morning", EVENING: "Evening" };
export const EVENT_TYPES = ["લગ્ન", "સગાઈ", "જન્મદિવસ", "બેસણું", "ધાર્મિક કાર્યક્રમ", "મીટિંગ / સભા", "જ્ઞાતિ કાર્યક્રમ", "અન્ય"];
export const BOOKING_STATUS_GU: Record<string, string> = { CONFIRMED: "પાકું", COMPLETED: "પૂરું", CANCELLED: "રદ" };
export const BOOKING_STATUS_EN: Record<string, string> = { CONFIRMED: "Confirmed", COMPLETED: "Completed", CANCELLED: "Cancelled" };

const slotsOverlap = (a: string, b: string) => a === "FULL" || b === "FULL" || a === b;

export type Conflict = { bookingId: number; bookingNo: string; hirerName: string; facility: string; fromDate: Date; toDate: Date; slot: string };

/**
 * Bookings that already hold any of these facilities on overlapping dates and slots.
 * Call inside the saving transaction: it locks the facility rows so two people
 * cannot book the same hall for the same day at the same moment.
 */
export async function findConflicts(tx: Tx, facilityIds: number[], fromYmd: string, toYmd: string, slot: string, exceptBookingId?: number): Promise<Conflict[]> {
  if (!facilityIds.length) return [];
  await tx.$queryRaw`SELECT id FROM "Facility" WHERE id IN (${Prisma.join(facilityIds)}) ORDER BY id FOR UPDATE`;
  const rows = await tx.bookingFacility.findMany({
    where: {
      facilityId: { in: facilityIds },
      booking: {
        status: { not: "CANCELLED" },
        fromDate: { lte: dateOnly(toYmd) },
        toDate: { gte: dateOnly(fromYmd) },
        ...(exceptBookingId ? { id: { not: exceptBookingId } } : {}),
      },
    },
    include: { booking: true, facility: true },
  });
  return rows
    .filter((r) => slotsOverlap(r.booking.slot, slot))
    .map((r) => ({ bookingId: r.booking.id, bookingNo: r.booking.bookingNo, hirerName: r.booking.hirerName, facility: r.facility.nameGu, fromDate: r.booking.fromDate, toDate: r.booking.toDate, slot: r.booking.slot }));
}

export type BillSummary = { total: number; paid: number; balance: number; depositAgreed: number; depositReceived: number; depositReturned: number; depositHeld: number };

export function summarize(b: { depositAmount: Prisma.Decimal; lines: { amount: Prisma.Decimal }[]; vouchers: { type: string; status: string; amount: Prisma.Decimal }[] }): BillSummary {
  const total = b.lines.reduce((n, l) => n + Number(l.amount), 0);
  const act = b.vouchers.filter((v) => v.status === "ACTIVE");
  const sum = (t: string) => act.filter((v) => v.type === t).reduce((n, v) => n + Number(v.amount), 0);
  const paid = sum("INCOME");
  const depositReceived = sum("DEPOSIT_IN");
  const depositReturned = sum("DEPOSIT_OUT");
  return { total, paid, balance: total - paid, depositAgreed: Number(b.depositAmount), depositReceived, depositReturned, depositHeld: depositReceived - depositReturned };
}

export async function loadBooking(id: number) {
  return db.booking.findUnique({
    where: { id },
    include: {
      facilities: { include: { facility: true } },
      lines: { orderBy: { sortOrder: "asc" } },
      vouchers: { orderBy: { id: "asc" }, include: { account: true, head: true } },
      movements: { orderBy: { id: "asc" }, include: { item: true } },
    },
  });
}

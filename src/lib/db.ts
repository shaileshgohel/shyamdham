import { PrismaClient, Prisma } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

export type Tx = Prisma.TransactionClient;

/** Atomically take the next number of a running series (family no., later receipt no.). */
export async function nextCounter(tx: Tx, key: string): Promise<number> {
  const row = await tx.counter.upsert({
    where: { key },
    create: { key, value: 1 },
    update: { value: { increment: 1 } },
  });
  return row.value;
}

export function formatFamilyNo(n: number) {
  return `M-${String(n).padStart(5, "0")}`;
}

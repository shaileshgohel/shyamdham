// Reset a user's password from the command line, e.g. when the only Super Admin is locked out.
//   npm run user:reset-password -- <username> <new-temporary-password>
// The user must choose their own password at next sign-in. The reset is written to the audit log.
try {
  process.loadEnvFile?.(".env");
} catch {
  /* no .env file: rely on the shell environment */
}

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const [username, password] = process.argv.slice(2);
  if (!username || !password) {
    console.error("Usage: npm run user:reset-password -- <username> <new-temporary-password>");
    process.exit(1);
  }
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    console.error("The password needs at least 8 characters, with a letter and a digit.");
    process.exit(1);
  }
  const user = await db.user.findUnique({ where: { username: username.toLowerCase() } });
  if (!user) {
    const names = (await db.user.findMany({ select: { username: true } })).map((u) => u.username);
    console.error(`No user "${username}". Users: ${names.join(", ") || "(none - run npm run db:seed first)"}`);
    process.exit(1);
  }
  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(password, 12), mustChangePassword: true, failedLogins: 0, lockedUntil: null, isActive: true },
    });
    await tx.session.deleteMany({ where: { userId: user.id } });
    await tx.auditLog.create({
      data: {
        userId: null,
        userName: "સર્વર કમાન્ડ (command line)",
        action: "password_reset",
        entity: "user",
        entityId: String(user.id),
        docNo: user.username,
        summary: `કમાન્ડ લાઇનથી પાસવર્ડ રીસેટ અને લૉક દૂર: ${user.fullName}`,
      },
    });
  });
  console.log(`Password reset for "${user.username}". Sign in with it; you will be asked to choose a new one.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

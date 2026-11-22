import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const ALGORITHM_VERSION = "1.0.0";
const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("demo-password-change-me", 12);
  const user = await prisma.user.upsert({
    where: { email: "demo@mynted.me" },
    update: {},
    create: {
      email: "demo@mynted.me",
      name: "Demo Collector",
      passwordHash,
      preferredLocale: "en",
    },
  });

  const existing = await prisma.scan.findFirst({
    where: { userId: user.id, title: "Demo synthetic scan" },
  });
  if (existing) {
    console.log("Seed already applied");
    return;
  }

  await prisma.scan.create({
    data: {
      userId: user.id,
      title: "Demo synthetic scan",
      algorithmVersion: ALGORITHM_VERSION,
      cardId: "swsh3-136",
      setId: "swsh3",
      setName: "Darkness Ablaze",
      number: "136",
      name: "Charizard",
      identitySource: "USER",
      faces: {
        create: [
          {
            face: "FRONT",
            status: "OK",
            borderL: 3.05,
            borderR: 2.95,
            borderT: 3.1,
            borderB: 2.9,
            lrRatio: 50.83,
            tbRatio: 51.67,
            uncertaintyLr: 0.4,
            uncertaintyTb: 0.4,
            confidence: 0.92,
            captureSource: "UPLOAD",
          },
          {
            face: "BACK",
            status: "OK",
            borderL: 3.2,
            borderR: 2.8,
            borderT: 3.0,
            borderB: 3.0,
            lrRatio: 53.33,
            tbRatio: 50,
            uncertaintyLr: 0.5,
            uncertaintyTb: 0.5,
            confidence: 0.88,
            captureSource: "UPLOAD",
          },
        ],
      },
    },
  });

  console.log("Seeded demo user demo@mynted.me / demo-password-change-me");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
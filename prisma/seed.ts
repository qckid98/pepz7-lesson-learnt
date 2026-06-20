import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import "dotenv/config";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // Create default admin user
  const adminPassword = await bcrypt.hash("BabihutaN!23", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@admin.com" },
    update: {
      password: adminPassword,
    },
    create: {
      email: "admin@admin.com",
      password: adminPassword,
      name: "Administrator",
      role: "ADMIN",
    },
  });
  console.log(`Admin created: ${admin.email} (password: BabihutaN!23)`);

  // Create sample folders
  const existingPublic = await prisma.folder.findFirst({
    where: { name: "Pengumuman", parentId: null },
  });
  const publicFolder = existingPublic ?? await prisma.folder.create({
    data: { name: "Pengumuman", visibility: "PUBLIC", sortOrder: 1 },
  });

  const existingMateri = await prisma.folder.findFirst({
    where: { name: "Materi Training", parentId: null },
  });
  const materiFolder = existingMateri ?? await prisma.folder.create({
    data: { name: "Materi Training", visibility: "PUBLIC", sortOrder: 2 },
  });

  const existingPrivate = await prisma.folder.findFirst({
    where: { name: "Dokumen Internal", parentId: null },
  });
  const privateFolder = existingPrivate ?? await prisma.folder.create({
    data: { name: "Dokumen Internal", visibility: "PRIVATE", sortOrder: 3 },
  });

  console.log("Sample folders:");
  console.log(`  - ${publicFolder.name} (PUBLIC)`);
  console.log(`  - ${materiFolder.name} (PUBLIC)`);
  console.log(`  - ${privateFolder.name} (PRIVATE)`);

  console.log("\nSeeding complete!");
  console.log("\n--- Login Credentials ---");
  console.log("Admin: admin@admin.com / BabihutaN!23");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaMssql } from "@prisma/adapter-mssql";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaMssql({
  server: process.env.DB_HOST!,
  port: Number(process.env.DB_PORT) || 1433,
  database: process.env.DB_NAME!,
  user: process.env.DB_USER!,
  password: process.env.DB_PASSWORD!,
  options: { encrypt: true, trustServerCertificate: true },
});
const prisma = new PrismaClient({ adapter });

const CATEGORIES: { name: string; icon: string; nodePrefix: string | null }[] = [
  { name: "Скоропорт", icon: "🥩", nodePrefix: null },
  { name: "Заморозка", icon: "❄️", nodePrefix: null },
  { name: "Бакалея", icon: "🌾", nodePrefix: "B4" },
  { name: "Напитки", icon: "🥤", nodePrefix: null },
  { name: "Алкоголь", icon: "🍷", nodePrefix: null },
  { name: "Детские товары", icon: "🍼", nodePrefix: "BA" },
  { name: "Товары для домашних питомцев", icon: "🐾", nodePrefix: null },
  { name: "Товары первой необходимости", icon: "🧻", nodePrefix: null },
  { name: "Промышленные товары", icon: "🔧", nodePrefix: null },
  { name: "Цветы", icon: "💐", nodePrefix: null },
];

// Exact Node code -> name, within a category (by name, matched against CATEGORIES above).
const NODES: { code: string; name: string; categoryName: string }[] = [
  { code: "B41", name: "Кофе", categoryName: "Бакалея" },
  { code: "B42A", name: "Конфеты", categoryName: "Бакалея" },
  { code: "B43D", name: "Печенье", categoryName: "Бакалея" },
  { code: "B44", name: "Чипсы", categoryName: "Бакалея" },
  { code: "B47A", name: "Супы, бульоны", categoryName: "Бакалея" },
  { code: "BA0", name: "Детское питание", categoryName: "Детские товары" },
];

async function main() {
  const store = await prisma.store.upsert({
    where: { code: "DEMO" },
    update: {},
    create: { code: "DEMO", name: "Demo store" },
  });

  const categoryIdByName = new Map<string, string>();
  for (const [index, category] of CATEGORIES.entries()) {
    const row = await prisma.category.upsert({
      where: { name: category.name },
      update: { icon: category.icon, nodePrefix: category.nodePrefix, sortOrder: index },
      create: { ...category, sortOrder: index },
    });
    categoryIdByName.set(row.name, row.id);
  }

  for (const node of NODES) {
    const categoryId = categoryIdByName.get(node.categoryName);
    if (!categoryId) continue;
    await prisma.node.upsert({
      where: { code: node.code },
      update: { name: node.name, categoryId },
      create: { code: node.code, name: node.name, categoryId },
    });
  }

  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@planograms.local";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "change-me";
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash,
      name: "Admin",
      role: "ADMIN",
      storeId: store.id,
    },
  });

  console.log(`Seeded store "${store.code}" and admin user "${email}".`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

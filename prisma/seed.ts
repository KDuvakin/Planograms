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

const CATEGORIES: {
  name: string;
  nameEn: string;
  nameEt: string;
  nameLv: string;
  icon: string;
  nodePrefix: string | null;
}[] = [
  { name: "Скоропорт", nameEn: "Perishables", nameEt: "Kiiresti riknev", nameLv: "Ātrbojīgās preces", icon: "🥩", nodePrefix: null },
  { name: "Заморозка", nameEn: "Frozen", nameEt: "Külmutatud", nameLv: "Saldētās preces", icon: "❄️", nodePrefix: null },
  { name: "Бакалея", nameEn: "Groceries", nameEt: "Toidukaubad", nameLv: "Pārtikas preces", icon: "🌾", nodePrefix: "B4" },
  { name: "Напитки", nameEn: "Beverages", nameEt: "Joogid", nameLv: "Dzērieni", icon: "🥤", nodePrefix: null },
  { name: "Алкоголь", nameEn: "Alcohol", nameEt: "Alkohol", nameLv: "Alkohols", icon: "🍷", nodePrefix: null },
  { name: "Детские товары", nameEn: "Baby products", nameEt: "Lastekaubad", nameLv: "Bērnu preces", icon: "🍼", nodePrefix: "BA" },
  { name: "Товары для домашних питомцев", nameEn: "Pet products", nameEt: "Lemmikloomatarbed", nameLv: "Mājdzīvnieku preces", icon: "🐾", nodePrefix: null },
  { name: "Товары первой необходимости", nameEn: "Essentials", nameEt: "Esmatarbekaubad", nameLv: "Pirmās nepieciešamības preces", icon: "🧻", nodePrefix: null },
  { name: "Промышленные товары", nameEn: "Household & hardware", nameEt: "Tööstuskaubad", nameLv: "Rūpniecības preces", icon: "🔧", nodePrefix: null },
  { name: "Цветы", nameEn: "Flowers", nameEt: "Lilled", nameLv: "Ziedi", icon: "💐", nodePrefix: null },
];

// Exact Node code -> name, within a category (by name, matched against CATEGORIES above).
const NODES: { code: string; name: string; nameEn: string; nameEt: string; nameLv: string; categoryName: string }[] = [
  { code: "B41", name: "Кофе", nameEn: "Coffee", nameEt: "Kohv", nameLv: "Kafija", categoryName: "Бакалея" },
  { code: "B42A", name: "Конфеты", nameEn: "Candy", nameEt: "Kompvekid", nameLv: "Konfektes", categoryName: "Бакалея" },
  { code: "B43D", name: "Печенье", nameEn: "Cookies", nameEt: "Küpsised", nameLv: "Cepumi", categoryName: "Бакалея" },
  { code: "B44", name: "Чипсы", nameEn: "Chips", nameEt: "Krõpsud", nameLv: "Čipsi", categoryName: "Бакалея" },
  { code: "B47A", name: "Супы, бульоны", nameEn: "Soups & broths", nameEt: "Supid, puljongid", nameLv: "Zupas, buljoni", categoryName: "Бакалея" },
  { code: "BA0", name: "Детское питание", nameEn: "Baby food", nameEt: "Beebitoit", nameLv: "Bērnu pārtika", categoryName: "Детские товары" },
];

async function main() {
  const store = await prisma.store.upsert({
    where: { code: "DEMO" },
    update: {},
    create: { code: "DEMO", name: "Demo store" },
  });

  const categoryIdByName = new Map<string, string>();
  for (const [index, category] of CATEGORIES.entries()) {
    const { name, ...rest } = category;
    const row = await prisma.category.upsert({
      where: { name },
      update: { ...rest, sortOrder: index },
      create: { name, ...rest, sortOrder: index },
    });
    categoryIdByName.set(row.name, row.id);
  }

  for (const { categoryName, ...node } of NODES) {
    const categoryId = categoryIdByName.get(categoryName);
    if (!categoryId) continue;
    await prisma.node.upsert({
      where: { code: node.code },
      update: { ...node, categoryId },
      create: { ...node, categoryId },
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

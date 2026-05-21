import "dotenv/config";
import { PrismaClient, Role } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding MediKlaim MDS...");

  // ── Departments ──
  const jabKewangan = await prisma.department.upsert({
    where: { id: "dept-kewangan" },
    update: {},
    create: { id: "dept-kewangan", name: "Jabatan Kewangan" },
  });

  const jabKejuruteraan = await prisma.department.upsert({
    where: { id: "dept-kejuruteraan" },
    update: {},
    create: { id: "dept-kejuruteraan", name: "Jabatan Kejuruteraan" },
  });

  const jabPentadbiran = await prisma.department.upsert({
    where: { id: "dept-pentadbiran" },
    update: {},
    create: { id: "dept-pentadbiran", name: "Jabatan Pentadbiran" },
  });

  // ── Users ──
  const pw = (plain: string) => bcrypt.hashSync(plain, 10);

  // Admin
  const admin = await prisma.user.upsert({
    where: { email: "admin@mds.gov.my" },
    update: {},
    create: {
      email: "admin@mds.gov.my",
      passwordHash: pw("Admin@1234"),
      name: "Admin Sistem",
      staffNo: "MDS-ADMIN-001",
      departmentId: jabPentadbiran.id,
      roles: { create: [{ role: Role.ADMIN }, { role: Role.CLAIMANT }] },
    },
  });

  // Setiausaha (Approver)
  const setiausaha = await prisma.user.upsert({
    where: { email: "su@mds.gov.my" },
    update: {},
    create: {
      email: "su@mds.gov.my",
      passwordHash: pw("Setiausaha@1234"),
      name: "Ahmad Setiausaha",
      staffNo: "MDS-SU-001",
      departmentId: jabPentadbiran.id,
      roles: { create: [{ role: Role.APPROVER }, { role: Role.CLAIMANT }] },
    },
  });

  // YDP
  await prisma.user.upsert({
    where: { email: "ydp@mds.gov.my" },
    update: {},
    create: {
      email: "ydp@mds.gov.my",
      passwordHash: pw("YDP@1234"),
      name: "Dato Yang Dipertua",
      staffNo: "MDS-YDP-001",
      departmentId: jabPentadbiran.id,
      roles: { create: [{ role: Role.YDP }, { role: Role.CLAIMANT }] },
    },
  });

  // Pegawai Kewangan (Finance + Ketua Jabatan Kewangan)
  const financeOfficer = await prisma.user.upsert({
    where: { email: "kewangan@mds.gov.my" },
    update: {},
    create: {
      email: "kewangan@mds.gov.my",
      passwordHash: pw("Kewangan@1234"),
      name: "Zainab Kewangan",
      staffNo: "MDS-KW-001",
      departmentId: jabKewangan.id,
      roles: { create: [{ role: Role.FINANCE }, { role: Role.HEAD }, { role: Role.CLAIMANT }] },
    },
  });

  // Ketua Kejuruteraan (Head)
  const ketuaKejuruteraan = await prisma.user.upsert({
    where: { email: "ketua.jurutera@mds.gov.my" },
    update: {},
    create: {
      email: "ketua.jurutera@mds.gov.my",
      passwordHash: pw("Ketua@1234"),
      name: "Razif Ketua Jurutera",
      staffNo: "MDS-KJ-001",
      departmentId: jabKejuruteraan.id,
      roles: { create: [{ role: Role.HEAD }, { role: Role.CLAIMANT }] },
    },
  });

  // Kakitangan biasa
  await prisma.user.upsert({
    where: { email: "ali@mds.gov.my" },
    update: {},
    create: {
      email: "ali@mds.gov.my",
      passwordHash: pw("Staff@1234"),
      name: "Ali bin Abu",
      staffNo: "MDS-STF-001",
      phone: "60123456789",
      departmentId: jabKejuruteraan.id,
      roles: { create: [{ role: Role.CLAIMANT }] },
    },
  });

  await prisma.user.upsert({
    where: { email: "siti@mds.gov.my" },
    update: {},
    create: {
      email: "siti@mds.gov.my",
      passwordHash: pw("Staff@1234"),
      name: "Siti binti Omar",
      staffNo: "MDS-STF-002",
      departmentId: jabKewangan.id,
      roles: { create: [{ role: Role.CLAIMANT }] },
    },
  });

  // Ahli Majlis
  await prisma.user.upsert({
    where: { email: "ahli1@mds.gov.my" },
    update: {},
    create: {
      email: "ahli1@mds.gov.my",
      passwordHash: pw("AhliMajlis@1234"),
      name: "Wan Ahmad Ahli Majlis",
      staffNo: "MDS-AM-001",
      isAhliMajlis: true,
      roles: { create: [{ role: Role.CLAIMANT }] },
    },
  });

  // ── Set department heads ──
  await prisma.department.update({
    where: { id: jabKewangan.id },
    data: { headId: financeOfficer.id },
  });

  await prisma.department.update({
    where: { id: jabKejuruteraan.id },
    data: { headId: ketuaKejuruteraan.id },
  });

  await prisma.department.update({
    where: { id: jabPentadbiran.id },
    data: { headId: setiausaha.id },
  });

  // ── Default blacklist keywords ──
  const keywords = [
    { keyword: "vitamin", reason: "Vitamin tidak layak dituntut" },
    { keyword: "supplement", reason: "Suplemen tidak layak dituntut" },
    { keyword: "kosmetik", reason: "Produk kosmetik tidak layak" },
    { keyword: "sunscreen", reason: "Produk kecantikan tidak layak" },
    { keyword: "hand sanitizer", reason: "Sanitizer biasa tidak layak" },
    { keyword: "mask beauty", reason: "Produk kecantikan tidak layak" },
  ];

  for (const kw of keywords) {
    await prisma.blacklistKeyword.upsert({
      where: { keyword: kw.keyword },
      update: {},
      create: { ...kw, addedById: admin.id },
    });
  }

  // ── Default settings ──
  await prisma.settings.upsert({
    where: { key: "default_annual_limit" },
    update: {},
    create: { key: "default_annual_limit", value: 1200 },
  });

  await prisma.settings.upsert({
    where: { key: "org_name" },
    update: {},
    create: { key: "org_name", value: "Majlis Daerah Setiu" },
  });

  await prisma.settings.upsert({
    where: { key: "wa_enabled" },
    update: {},
    create: { key: "wa_enabled", value: false },
  });

  await prisma.settings.upsert({
    where: { key: "wa_rate_limit_per_min" },
    update: {},
    create: { key: "wa_rate_limit_per_min", value: 20 },
  });

  await prisma.settings.upsert({
    where: { key: "wa_rate_limit_per_day" },
    update: {},
    create: { key: "wa_rate_limit_per_day", value: 500 },
  });

  await prisma.settings.upsert({
    where: { key: "wa_quiet_hours_start" },
    update: {},
    create: { key: "wa_quiet_hours_start", value: 22 },
  });

  await prisma.settings.upsert({
    where: { key: "wa_quiet_hours_end" },
    update: {},
    create: { key: "wa_quiet_hours_end", value: 7 },
  });

  // ── Annual allocations for current year ──
  const currentYear = new Date().getFullYear();
  const allUsers = await prisma.user.findMany({ select: { id: true } });
  for (const u of allUsers) {
    await prisma.annualAllocation.upsert({
      where: { userId_year: { userId: u.id, year: currentYear } },
      update: {},
      create: {
        userId: u.id,
        year: currentYear,
        limitMyr: 1200,
        usedMyr: 0,
      },
    });
  }

  console.log("✅ Seed completed.");
  console.log("\nDefault logins:");
  console.log("  admin@mds.gov.my         / Admin@1234");
  console.log("  su@mds.gov.my            / Setiausaha@1234");
  console.log("  ydp@mds.gov.my           / YDP@1234");
  console.log("  kewangan@mds.gov.my      / Kewangan@1234");
  console.log("  ketua.jurutera@mds.gov.my / Ketua@1234");
  console.log("  ali@mds.gov.my           / Staff@1234");
  console.log("  ahli1@mds.gov.my         / AhliMajlis@1234");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

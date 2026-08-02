require('dotenv').config();
const { PrismaClient } = require('../generated/prisma');
const { PrismaPg } = require('@prisma/adapter-pg');
const bcrypt = require('bcrypt');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
async function main() {
  // 1. Create Roles
  const adminRole = await prisma.role.upsert({
    where: { name: 'Admin' },
    update: {},
    create: { name: 'Admin' },
  });
  await prisma.role.upsert({
    where: { name: 'User' },
    update: {},
    create: { name: 'User' },
  });
  await prisma.role.upsert({
    where: { name: 'Manager' },
    update: {},
    create: { name: 'Manager' },
  });

  // 2. Create Shifts
  await prisma.shift.upsert({
    where: { name: 'Morning' },
    update: {},
    create: { name: 'Morning' },
  });
  await prisma.shift.upsert({
    where: { name: 'Evening' },
    update: {},
    create: { name: 'Evening' },
  });
  await prisma.shift.upsert({
    where: { name: 'Night' },
    update: {},
    create: { name: 'Night' },
  });

  // 3. Create one Admin user (password: "admin123" — CHANGE THIS LATER)
  const hashedPassword = await bcrypt.hash('admin123', 10);

  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      fullName: 'System Admin',
      username: 'admin',
      email: 'admin@occ.local',
      passwordHash: hashedPassword,
      roleId: adminRole.id,
      isActive: true,
    },
  });

  console.log('✅ Seed data created: 3 roles, 3 shifts, 1 admin user');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
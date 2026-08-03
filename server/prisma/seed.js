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
  // 4. Create sample Fixed Tasks for the Morning shift
  const morningShift = await prisma.shift.findUnique({ where: { name: 'Morning' } });

  await prisma.fixedTask.upsert({
    where: { id: 1 },
    update: {},
    create: {
      taskName: 'Check Alerts',
      description: 'Review overnight system alerts',
      shiftId: morningShift.id,
      isActive: true,
      createdById: 1,
    },
  });

  await prisma.fixedTask.upsert({
    where: { id: 2 },
    update: {},
    create: {
      taskName: 'Monitor UAE Batch',
      description: 'Check UAE batch processing status',
      shiftId: morningShift.id,
      isActive: true,
      createdById: 1,
    },
  });

  await prisma.fixedTask.upsert({
    where: { id: 3 },
    update: {},
    create: {
      taskName: 'Verify Settlement Reports',
      description: 'Confirm settlement reports generated correctly',
      shiftId: morningShift.id,
      isActive: true,
      createdById: 1,
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
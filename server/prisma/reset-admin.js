require('dotenv').config();
const { PrismaClient } = require('../generated/prisma');
const { PrismaPg } = require('@prisma/adapter-pg');
const bcrypt = require('bcrypt');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const [username, newPassword] = process.argv.slice(2);
  if (!username || !newPassword) {
    console.error('Usage: node prisma/reset-admin.js zma 1234');
    process.exit(1);
  }
  const passwordHash = await bcrypt.hash(newPassword, 10);
  const user = await prisma.user.update({
    where: { username },
    data: { passwordHash, isActive: true },
  });
  console.log('Updated:', user.username, '| active =', user.isActive);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
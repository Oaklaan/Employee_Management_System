require('dotenv').config();
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  await p.user.upsert({ where: { email: 'admin@hr.com' }, update: {},
    create: { email: 'admin@hr.com', password: await bcrypt.hash('admin123', 10), role: 'ADMIN' } });
  console.log('Admin created: admin@hr.com / admin123'); await p.$disconnect();
})();

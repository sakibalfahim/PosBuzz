/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient, Prisma } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const password = process.env.SEED_DEMO_PASSWORD || 'DemoPass123!';
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email: 'demo@posbuzz.dev' },
    update: { passwordHash },
    create: {
      email: 'demo@posbuzz.dev',
      passwordHash,
    },
  });

  const products = [
    { name: 'Espresso Beans 1kg', sku: 'COFFEE-001', price: '24.99', stockQuantity: 50 },
    { name: 'Ceramic Mug', sku: 'MUG-100', price: '12.50', stockQuantity: 100 },
    { name: 'Oat Milk Carton', sku: 'MILK-OAT', price: '3.75', stockQuantity: 80 },
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: { sku: p.sku },
      update: {
        name: p.name,
        price: new Prisma.Decimal(p.price),
        stockQuantity: p.stockQuantity,
      },
      create: {
        name: p.name,
        sku: p.sku,
        price: new Prisma.Decimal(p.price),
        stockQuantity: p.stockQuantity,
      },
    });
  }

  console.log(`Seeded demo user ${user.email} and ${products.length} products`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

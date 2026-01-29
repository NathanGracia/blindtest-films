/**
 * Simple rename: jeux -> games (no tracks to migrate)
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Get current "jeux" category
  const jeux = await prisma.category.findUnique({ where: { id: 'jeux' } });

  if (!jeux) {
    console.log('Category "jeux" not found');
    return;
  }

  console.log('Current category:', jeux);

  // Delete "jeux"
  await prisma.category.delete({ where: { id: 'jeux' } });
  console.log('✅ Deleted "jeux"');

  // Create "games"
  await prisma.category.create({
    data: {
      id: 'games',
      name: jeux.name,
      icon: jeux.icon,
      color: jeux.color
    }
  });
  console.log('✅ Created "games"');

  await prisma.$disconnect();
}

main();

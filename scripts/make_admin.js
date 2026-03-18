/**
 * Donne les droits admin à un utilisateur existant.
 * Usage: node scripts/make_admin.js <username>
 */
const { PrismaClient } = require('@prisma/client');

const username = process.argv[2];
if (!username) {
  console.error('Usage: node scripts/make_admin.js <username>');
  process.exit(1);
}

const prisma = new PrismaClient();

prisma.user.update({
  where: { username: username.toLowerCase() },
  data: { isAdmin: true },
  select: { id: true, username: true, displayName: true, isAdmin: true },
})
  .then(user => {
    console.log(`✅ ${user.username} est maintenant admin.`);
  })
  .catch(err => {
    if (err.code === 'P2025') {
      console.error(`❌ Utilisateur "${username}" introuvable.`);
    } else {
      console.error('Erreur:', err.message);
    }
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

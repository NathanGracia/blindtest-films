const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.ladderEntry.upsert({
  where: { pseudo_weekId: { pseudo: 'guest', weekId: 'all-time' } },
  update: { bestScore: 4200, gamesPlayed: 7 },
  create: { pseudo: 'guest', weekId: 'all-time', bestScore: 4200, gamesPlayed: 7 },
})
  .then(r => console.log('Done:', r))
  .finally(() => p.$disconnect());

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('Initialisation des catégories...');

  // Charger les catégories depuis le fichier JSON
  const categoriesPath = path.join(process.cwd(), 'data', 'categories.json');
  const categories = JSON.parse(fs.readFileSync(categoriesPath, 'utf-8'));

  // Insérer les catégories
  console.log(`Insertion de ${categories.length} catégories...`);
  for (const category of categories) {
    await prisma.category.upsert({
      where: { id: category.id },
      update: {
        name: category.name,
        icon: category.icon,
        color: category.color,
      },
      create: {
        id: category.id,
        name: category.name,
        icon: category.icon,
        color: category.color,
      },
    });
  }

  console.log('Catégories initialisées !');
  console.log('\nPour ajouter des tracks, utilisez:');
  console.log('  - L\'interface admin: http://localhost:3000/admin/tracks');
  console.log('  - Le script Python: python scripts/hydrate_db.py --api-key VOTRE_CLE');
}

main()
  .catch((e) => {
    console.error('Erreur:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

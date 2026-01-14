import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('Début de la migration des données...');

  // Charger les fichiers JSON
  const categoriesPath = path.join(process.cwd(), 'data', 'categories.json');
  const tracksPath = path.join(process.cwd(), 'data', 'tracks.json');

  const categories = JSON.parse(fs.readFileSync(categoriesPath, 'utf-8'));
  const tracks = JSON.parse(fs.readFileSync(tracksPath, 'utf-8'));

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

  // Insérer les tracks
  console.log(`Insertion de ${tracks.length} tracks...`);
  for (const track of tracks) {
    await prisma.track.upsert({
      where: { id: track.id },
      update: {
        title: track.title,
        acceptedAnswers: JSON.stringify(track.acceptedAnswers),
        audioFile: track.audioFile,
        imageFile: track.imageFile,
        timeLimit: track.timeLimit,
        categoryId: track.categoryId,
      },
      create: {
        id: track.id,
        title: track.title,
        acceptedAnswers: JSON.stringify(track.acceptedAnswers),
        audioFile: track.audioFile,
        imageFile: track.imageFile,
        timeLimit: track.timeLimit,
        categoryId: track.categoryId,
      },
    });
  }

  console.log('Migration terminée !');
}

main()
  .catch((e) => {
    console.error('Erreur lors de la migration:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

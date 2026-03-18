import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const tracks = [
  // Films
  {
    title: 'Harry Potter and the Sorcerer\'s Stone',
    titleVF: 'Harry Potter à l\'école des sorciers',
    acceptedAnswers: JSON.stringify(['harry potter', 'harry potter a l ecole des sorciers', 'harry potter and the sorcerer\'s stone', 'harry potter and the philosopher\'s stone']),
    audioFile: '/audio/harry-potter.mp3',
    imageFile: null,
    timeLimit: 30,
    startTime: 0,
    categoryId: 'films',
  },
  {
    title: 'Indiana Jones',
    titleVF: 'Indiana Jones',
    acceptedAnswers: JSON.stringify(['indiana jones', 'indiana jones and the raiders of the lost ark', 'les aventuriers de l arche perdue']),
    audioFile: '/audio/indiana-jones.mp3',
    imageFile: null,
    timeLimit: 30,
    startTime: 0,
    categoryId: 'films',
  },
  {
    title: 'Pirates of the Caribbean',
    titleVF: 'Pirates des Caraïbes',
    acceptedAnswers: JSON.stringify(['pirates of the caribbean', 'pirates des caraibes', 'pirates des caraïbes']),
    audioFile: '/audio/pirates-caraibes.mp3',
    imageFile: null,
    timeLimit: 30,
    startTime: 0,
    categoryId: 'films',
  },
  {
    title: 'The Lion King',
    titleVF: 'Le Roi Lion',
    acceptedAnswers: JSON.stringify(['the lion king', 'le roi lion', 'roi lion']),
    audioFile: '/audio/roi-lion.mp3',
    imageFile: null,
    timeLimit: 30,
    startTime: 0,
    categoryId: 'films',
  },
  {
    title: 'The Lord of the Rings',
    titleVF: 'Le Seigneur des Anneaux',
    acceptedAnswers: JSON.stringify(['the lord of the rings', 'le seigneur des anneaux', 'seigneur des anneaux', 'lotr']),
    audioFile: '/audio/seigneur-anneaux.mp3',
    imageFile: null,
    timeLimit: 30,
    startTime: 0,
    categoryId: 'films',
  },
  {
    title: 'Star Wars',
    titleVF: 'Star Wars',
    acceptedAnswers: JSON.stringify(['star wars', 'star wars a new hope', 'la guerre des etoiles']),
    audioFile: '/audio/star-wars.mp3',
    imageFile: null,
    timeLimit: 30,
    startTime: 0,
    categoryId: 'films',
  },
  {
    title: 'Titanic',
    titleVF: 'Titanic',
    acceptedAnswers: JSON.stringify(['titanic']),
    audioFile: '/audio/titanic.mp3',
    imageFile: null,
    timeLimit: 30,
    startTime: 0,
    categoryId: 'films',
  },
  // Séries
  {
    title: 'Game of Thrones',
    titleVF: 'Game of Thrones',
    acceptedAnswers: JSON.stringify(['game of thrones', 'got', 'le trone de fer']),
    audioFile: '/audio/opening-credits-game-of-thrones-season-8-hbo--1768376854603.mp3',
    imageFile: '/images/daenerys-1768376966389.png',
    timeLimit: 30,
    startTime: 0,
    categoryId: 'series',
  },
  // Jeux vidéo — placeholder audio (même fichier réutilisé pour la démo)
  {
    title: 'The Legend of Zelda',
    titleVF: 'The Legend of Zelda',
    acceptedAnswers: JSON.stringify(['zelda', 'the legend of zelda', 'legend of zelda']),
    audioFile: '/audio/star-wars.mp3',
    imageFile: null,
    timeLimit: 30,
    startTime: 0,
    categoryId: 'jeux',
  },
  // Anime — placeholder audio pour la démo
  {
    title: 'Dragon Ball Z',
    titleVF: 'Dragon Ball Z',
    acceptedAnswers: JSON.stringify(['dragon ball z', 'dragon ball', 'dbz']),
    audioFile: '/audio/roi-lion.mp3',
    imageFile: null,
    timeLimit: 30,
    startTime: 0,
    categoryId: 'anime',
  },
];

async function main() {
  console.log('Insertion de 10 tracks...');

  for (const track of tracks) {
    const created = await prisma.track.create({ data: track });
    console.log(`  ✓ [${created.categoryId}] ${created.title} (id: ${created.id})`);
  }

  const total = await prisma.track.count();
  console.log(`\nTotal tracks en base : ${total}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

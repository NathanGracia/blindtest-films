import { prisma } from './prisma';
import { Track, Category } from '@/types';

// Convertir un track Prisma vers le type Track
function toTrack(dbTrack: {
  id: number;
  title: string;
  acceptedAnswers: string;
  audioFile: string;
  imageFile: string | null;
  categoryId: string;
  timeLimit: number;
}): Track {
  return {
    ...dbTrack,
    acceptedAnswers: JSON.parse(dbTrack.acceptedAnswers),
  };
}

// Lecture des tracks
export async function readTracks(): Promise<Track[]> {
  const tracks = await prisma.track.findMany({
    orderBy: { id: 'asc' },
  });
  return tracks.map(toTrack);
}

// Lecture des catégories
export async function readCategories(): Promise<Category[]> {
  return prisma.category.findMany({
    orderBy: { name: 'asc' },
  });
}

// Obtenir un track par ID
export async function getTrackById(id: number): Promise<Track | null> {
  const track = await prisma.track.findUnique({
    where: { id },
  });
  return track ? toTrack(track) : null;
}

// Obtenir une catégorie par ID
export async function getCategoryById(id: string): Promise<Category | null> {
  return prisma.category.findUnique({
    where: { id },
  });
}

// Ajouter un track
export async function addTrack(track: Omit<Track, 'id'>): Promise<Track> {
  const newTrack = await prisma.track.create({
    data: {
      title: track.title,
      acceptedAnswers: JSON.stringify(track.acceptedAnswers),
      audioFile: track.audioFile,
      imageFile: track.imageFile,
      categoryId: track.categoryId,
      timeLimit: track.timeLimit,
    },
  });
  return toTrack(newTrack);
}

// Mettre à jour un track
export async function updateTrack(id: number, updates: Partial<Track>): Promise<Track | null> {
  try {
    const data: Record<string, unknown> = {};

    if (updates.title !== undefined) data.title = updates.title;
    if (updates.acceptedAnswers !== undefined) data.acceptedAnswers = JSON.stringify(updates.acceptedAnswers);
    if (updates.audioFile !== undefined) data.audioFile = updates.audioFile;
    if (updates.imageFile !== undefined) data.imageFile = updates.imageFile;
    if (updates.categoryId !== undefined) data.categoryId = updates.categoryId;
    if (updates.timeLimit !== undefined) data.timeLimit = updates.timeLimit;

    const track = await prisma.track.update({
      where: { id },
      data,
    });
    return toTrack(track);
  } catch {
    return null;
  }
}

// Supprimer un track
export async function deleteTrack(id: number): Promise<boolean> {
  try {
    await prisma.track.delete({
      where: { id },
    });
    return true;
  } catch {
    return false;
  }
}

// Ajouter une catégorie
export async function addCategory(category: Category): Promise<Category> {
  try {
    return await prisma.category.create({
      data: category,
    });
  } catch {
    throw new Error(`La catégorie avec l'ID "${category.id}" existe déjà`);
  }
}

// Mettre à jour une catégorie
export async function updateCategory(id: string, updates: Partial<Category>): Promise<Category | null> {
  try {
    const { id: _id, ...data } = updates;
    return await prisma.category.update({
      where: { id },
      data,
    });
  } catch {
    return null;
  }
}

// Supprimer une catégorie
export async function deleteCategory(id: string): Promise<boolean> {
  try {
    await prisma.category.delete({
      where: { id },
    });
    return true;
  } catch {
    return false;
  }
}

// Obtenir les tracks par catégorie
export async function getTracksByCategory(categoryId: string): Promise<Track[]> {
  const tracks = await prisma.track.findMany({
    where: { categoryId },
    orderBy: { id: 'asc' },
  });
  return tracks.map(toTrack);
}

// Obtenir les tracks par catégories multiples
export async function getTracksByCategories(categoryIds: string[]): Promise<Track[]> {
  const tracks = await prisma.track.findMany({
    where: categoryIds.length > 0 ? { categoryId: { in: categoryIds } } : undefined,
    orderBy: { id: 'asc' },
  });
  return tracks.map(toTrack);
}

// Compter les tracks par catégorie
export async function countTracksByCategory(): Promise<Record<string, number>> {
  const counts = await prisma.track.groupBy({
    by: ['categoryId'],
    _count: { id: true },
  });

  const result: Record<string, number> = {};
  for (const count of counts) {
    result[count.categoryId] = count._count.id;
  }
  return result;
}

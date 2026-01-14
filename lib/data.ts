import fs from 'fs/promises';
import path from 'path';
import { Track, Category } from '@/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const TRACKS_FILE = path.join(DATA_DIR, 'tracks.json');
const CATEGORIES_FILE = path.join(DATA_DIR, 'categories.json');

// Lecture des tracks
export async function readTracks(): Promise<Track[]> {
  try {
    const data = await fs.readFile(TRACKS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Erreur lecture tracks:', error);
    return [];
  }
}

// Écriture des tracks
export async function writeTracks(tracks: Track[]): Promise<void> {
  await fs.writeFile(TRACKS_FILE, JSON.stringify(tracks, null, 2), 'utf-8');
}

// Lecture des catégories
export async function readCategories(): Promise<Category[]> {
  try {
    const data = await fs.readFile(CATEGORIES_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Erreur lecture catégories:', error);
    return [];
  }
}

// Écriture des catégories
export async function writeCategories(categories: Category[]): Promise<void> {
  await fs.writeFile(CATEGORIES_FILE, JSON.stringify(categories, null, 2), 'utf-8');
}

// Obtenir un track par ID
export async function getTrackById(id: number): Promise<Track | null> {
  const tracks = await readTracks();
  return tracks.find(t => t.id === id) || null;
}

// Obtenir une catégorie par ID
export async function getCategoryById(id: string): Promise<Category | null> {
  const categories = await readCategories();
  return categories.find(c => c.id === id) || null;
}

// Ajouter un track
export async function addTrack(track: Omit<Track, 'id'>): Promise<Track> {
  const tracks = await readTracks();
  const maxId = tracks.reduce((max, t) => Math.max(max, t.id), 0);
  const newTrack: Track = { ...track, id: maxId + 1 };
  tracks.push(newTrack);
  await writeTracks(tracks);
  return newTrack;
}

// Mettre à jour un track
export async function updateTrack(id: number, updates: Partial<Track>): Promise<Track | null> {
  const tracks = await readTracks();
  const index = tracks.findIndex(t => t.id === id);
  if (index === -1) return null;

  tracks[index] = { ...tracks[index], ...updates, id };
  await writeTracks(tracks);
  return tracks[index];
}

// Supprimer un track
export async function deleteTrack(id: number): Promise<boolean> {
  const tracks = await readTracks();
  const filteredTracks = tracks.filter(t => t.id !== id);
  if (filteredTracks.length === tracks.length) return false;

  await writeTracks(filteredTracks);
  return true;
}

// Ajouter une catégorie
export async function addCategory(category: Category): Promise<Category> {
  const categories = await readCategories();

  // Vérifier si l'ID existe déjà
  if (categories.some(c => c.id === category.id)) {
    throw new Error(`La catégorie avec l'ID "${category.id}" existe déjà`);
  }

  categories.push(category);
  await writeCategories(categories);
  return category;
}

// Mettre à jour une catégorie
export async function updateCategory(id: string, updates: Partial<Category>): Promise<Category | null> {
  const categories = await readCategories();
  const index = categories.findIndex(c => c.id === id);
  if (index === -1) return null;

  // Ne pas permettre de changer l'ID
  categories[index] = { ...categories[index], ...updates, id };
  await writeCategories(categories);
  return categories[index];
}

// Supprimer une catégorie
export async function deleteCategory(id: string): Promise<boolean> {
  const categories = await readCategories();
  const filteredCategories = categories.filter(c => c.id !== id);
  if (filteredCategories.length === categories.length) return false;

  await writeCategories(filteredCategories);
  return true;
}

// Obtenir les tracks par catégorie
export async function getTracksByCategory(categoryId: string): Promise<Track[]> {
  const tracks = await readTracks();
  return tracks.filter(t => t.categoryId === categoryId);
}

// Obtenir les tracks par catégories multiples
export async function getTracksByCategories(categoryIds: string[]): Promise<Track[]> {
  const tracks = await readTracks();
  if (categoryIds.length === 0) return tracks;
  return tracks.filter(t => categoryIds.includes(t.categoryId));
}

// Compter les tracks par catégorie
export async function countTracksByCategory(): Promise<Record<string, number>> {
  const tracks = await readTracks();
  const counts: Record<string, number> = {};

  for (const track of tracks) {
    counts[track.categoryId] = (counts[track.categoryId] || 0) + 1;
  }

  return counts;
}

import type { Track } from '@/types';
import { shuffleArray } from './utils';

/**
 * Distribue équitablement les tracks entre les catégories sélectionnées.
 *
 * Exemple: 3 catégories, 25 rounds
 * - Films: 100 tracks, Séries: 80 tracks, Jeux: 60 tracks
 * - Résultat: 9 Films + 8 Séries + 8 Jeux = 25 rounds
 *
 * @param categories - Liste des IDs de catégories
 * @param totalRounds - Nombre total de rounds souhaités
 * @param tracksPerCategory - Map des tracks groupés par categoryId
 * @returns Tableau de tracks mélangé avec distribution équitable
 */
export function distributeTracksEquitably(
  categories: string[],
  totalRounds: number,
  tracksPerCategory: Record<string, Track[]>
): Track[] {
  if (categories.length === 0) {
    return [];
  }

  // Shuffler chaque catégorie AVANT la sélection pour avoir de la variété
  const shuffledTracksPerCategory: Record<string, Track[]> = {};
  for (const cat of categories) {
    if (tracksPerCategory[cat]) {
      shuffledTracksPerCategory[cat] = shuffleArray(tracksPerCategory[cat]);
    }
  }

  const numCategories = categories.length;
  const basePerCategory = Math.floor(totalRounds / numCategories);
  const remainder = totalRounds % numCategories;

  const result: Track[] = [];
  let remainingRounds = totalRounds;

  // Phase 1: Assigner le quota de base à chaque catégorie
  for (const cat of categories) {
    const available = shuffledTracksPerCategory[cat]?.length || 0;
    const toTake = Math.min(basePerCategory, available);

    if (toTake > 0) {
      result.push(...shuffledTracksPerCategory[cat].slice(0, toTake));
      remainingRounds -= toTake;
    }
  }

  // Phase 2: Distribuer le reste aux catégories qui ont encore de la capacité
  for (let i = 0; i < categories.length && remainingRounds > 0; i++) {
    const cat = categories[i];
    const available = shuffledTracksPerCategory[cat]?.length || 0;
    const alreadyTaken = result.filter(t => t.categoryId === cat).length;

    if (alreadyTaken < available && i < remainder) {
      result.push(shuffledTracksPerCategory[cat][alreadyTaken]);
      remainingRounds--;
    }
  }

  // Mélanger pour éviter que les catégories soient groupées
  return shuffleArray(result);
}

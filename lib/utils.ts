/**
 * Normalise une chaîne pour la comparaison :
 * - Convertit en minuscules
 * - Supprime les accents
 * - Supprime les espaces en début/fin
 * - Remplace les espaces multiples par un seul
 */
export function normalizeAnswer(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Supprime les accents
    .trim()
    .replace(/\s+/g, ' '); // Normalise les espaces
}

/**
 * Vérifie si la réponse donnée correspond à l'une des réponses acceptées
 */
export function checkAnswer(input: string, acceptedAnswers: string[]): boolean {
  const normalizedInput = normalizeAnswer(input);
  return acceptedAnswers.some(
    (answer) => normalizeAnswer(answer) === normalizedInput
  );
}

/**
 * Mélange un tableau de façon aléatoire (Fisher-Yates)
 */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

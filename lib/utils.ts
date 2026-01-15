/**
 * Calcul de la distance de Levenshtein (nombre de modifications nécessaires)
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,    // suppression
          dp[i][j - 1] + 1,    // insertion
          dp[i - 1][j - 1] + 1 // substitution
        );
      }
    }
  }

  return dp[m][n];
}

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
 * Vérifie si la réponse est proche (à 2 caractères près)
 */
export function isAnswerClose(input: string, acceptedAnswers: string[]): boolean {
  const normalizedInput = normalizeAnswer(input);
  for (const answer of acceptedAnswers) {
    const normalizedAnswer = normalizeAnswer(answer);
    const distance = levenshteinDistance(normalizedInput, normalizedAnswer);
    if (distance <= 2 && distance > 0) {
      return true;
    }
  }
  return false;
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

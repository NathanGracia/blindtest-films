export interface AchievementDef {
  code: string;
  name: string;
  description: string;
  icon: string;        // emoji fallback
  emoteCode?: string;  // code de l'emote débloquée par ce succès
}

export const ACHIEVEMENTS: Record<string, AchievementDef> = {
  // Débutant
  first_game: {
    code: 'first_game',
    name: 'Première partie',
    description: 'Jouer sa première partie',
    icon: '🎮',
  },
  first_correct: {
    code: 'first_correct',
    name: 'Premier sang',
    description: 'Trouver sa première bonne réponse',
    icon: '🎯',
  },
  emote_used: {
    code: 'emote_used',
    name: 'Expressif',
    description: 'Utiliser une emote dans le chat',
    icon: '🎭',
  },
  // Performance
  champion: {
    code: 'champion',
    name: 'Champion',
    description: 'Finir 1er d\'une partie avec au moins 2 joueurs',
    icon: '🏆',
  },
  perfect: {
    code: 'perfect',
    name: 'Sans faute',
    description: 'Trouver toutes les tracks d\'une partie',
    icon: '💯',
  },
  speed_demon: {
    code: 'speed_demon',
    name: 'Éclair',
    description: 'Trouver une réponse dans les 3 premières secondes',
    icon: '⚡',
  },
  // Régularité
  habitue: {
    code: 'habitue',
    name: 'Habitué',
    description: 'Jouer 100 parties',
    icon: '📅',
  },
  veteran: {
    code: 'veteran',
    name: 'Vétéran',
    description: 'Jouer 1000 parties',
    icon: '🎖️',
  },
  hat_trick: {
    code: 'hat_trick',
    name: 'Hat-trick',
    description: 'Finir 1er 3 fois de suite',
    icon: '🔥',
  },
  // Fun / Easter egg
  night_owl: {
    code: 'night_owl',
    name: 'Oiseau de nuit',
    description: 'Jouer entre minuit et 6h du matin',
    icon: '🦉',
  },
  lucky: {
    code: 'lucky',
    name: 'Chanceux',
    description: 'Trouver une réponse après avoir perdu 2 vies',
    icon: '🍀',
  },
  chatty: {
    code: 'chatty',
    name: 'Bavard',
    description: 'Envoyer 30 messages dans le chat',
    icon: '💬',
  },
};

export interface AchievementDef {
  code: string;
  name: string;
  description: string;
  icon: string;
}

export const ACHIEVEMENTS: Record<string, AchievementDef> = {
  first_game: {
    code: 'first_game',
    name: 'Première partie',
    description: 'Jouer sa première partie',
    icon: '🎮',
  },
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
};

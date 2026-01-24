// Types pour les catégories
export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
}

// Types pour les musiques (anciennement Film)
export interface Track {
  id: number;
  title: string;        // Titre VO (version originale)
  titleVF: string | null; // Titre VF (version française)
  acceptedAnswers: string[];
  audioFile: string;
  imageFile: string | null;
  categoryId: string;
  timeLimit: number;
  startTime: number; // Seconde de départ de la musique
  reportCount?: number; // Nombre de signalements
}

// Alias pour compatibilité (à supprimer progressivement)
export type Film = Track;

export interface Attempt {
  text: string;
  isCorrect: boolean;
  timestamp: number;
}

// Types Multijoueur
export interface Player {
  id: string;
  pseudo: string;
  score: number;
  hasFoundThisRound?: boolean;
}

export interface RoomState {
  code: string;
  players: Player[];
  currentTrackIndex: number;
  isPlaying: boolean;
  hostId: string | null;
  timeRemaining: number;
  currentTrack: {
    audioFile: string;
    imageFile: string | null;
    timeLimit: number;
    startTime: number;
  } | null;
  totalTracks: number;
  categories: string[];
  isPublic?: boolean;
  startCountdownValue?: number | null;
  isCountingDown?: boolean;
  roundFinders?: string[];
}

export interface ChatMessage {
  pseudo: string;
  message: string;
  isCorrect: boolean;
  playerId: string;
  isFromFinder?: boolean;
  isHint?: boolean;
}

// Types Admin
export interface AdminSession {
  authenticated: boolean;
  expiresAt: number;
}

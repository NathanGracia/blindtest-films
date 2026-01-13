export interface Film {
  id: number;
  title: string;
  acceptedAnswers: string[];
  audioFile: string;
  timeLimit: number;
}

export interface GameState {
  currentIndex: number;
  score: number;
  timeRemaining: number;
  isPlaying: boolean;
  isFinished: boolean;
  showResult: boolean;
  wasCorrect: boolean;
}

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
}

export interface RoomState {
  code: string;
  players: Player[];
  currentFilmIndex: number;
  isPlaying: boolean;
  hostId: string;
  timeRemaining: number;
  currentFilm: {
    audioFile: string;
    timeLimit: number;
  } | null;
  totalFilms: number;
}

export interface ChatMessage {
  pseudo: string;
  message: string;
  isCorrect: boolean;
  playerId: string;
}

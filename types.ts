export enum GameStatus {
  IDLE = 'IDLE',
  DIFFICULTY_SELECT = 'DIFFICULTY_SELECT',
  PLAYING = 'PLAYING',
  WON = 'WON',
  LOST = 'LOST',
  VERSUS_SETUP = 'VERSUS_SETUP'
}

export enum GameMode {
  CLASSIC = 'CLASSIC',
  AI_CHALLENGE = 'AI_CHALLENGE',
  THEMATIC = 'THEMATIC',
  VERSUS = 'VERSUS'
}

export enum Difficulty {
  CASUAL = 'CASUAL',
  NORMAL = 'NORMAL',
  BRUTAL = 'BRUTAL',
  MEGA_BRUTAL = 'MEGA_BRUTAL'
}

export type Theme = 'dark' | 'light';

export interface WordData {
  word: string;
  hint: string;
  category: string;
}

export interface Settings {
  theme: Theme;
  strictMode: boolean;
  animations: boolean; // Novo: Controla transições e keyframes
  effects: boolean;    // Novo: Controla sombras, blur e glow
}

export interface GameState {
  status: GameStatus;
  mode: GameMode;
  difficulty: Difficulty;
  currentWord: string;
  normalizedWord: string;
  category: string;
  hint: string;
  guessedLetters: Set<string>;
  lives: number;
  maxLives: number;
  score: number;
  streak: number;
  loading: boolean;
  error: string | null;
  settings: Settings;
  megaBrutalUnlocked: boolean;
}

export const DEFAULT_LIVES = 6;
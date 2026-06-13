export type AchievementCategory =
  | 'crossover'
  | 'legacy'
  | 'found-family'
  | 'multiverse'
  | 'timeline'
  | 'origins';

export interface RankTier {
  id: string;
  name: string;
  minEpisodes: number;
  tagline: string;
  icon: string;
}

export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  icon: string;
  rows?: number[];
  series?: string;
  minStreak?: number;
}

export interface CrossoverEvent {
  id: string;
  name: string;
  tagline: string;
  rows: number[];
  icon: string;
}

export interface AchievementState extends AchievementDefinition {
  unlocked: boolean;
  progress: number;
  total: number;
}

export interface CrossoverProgress {
  event: CrossoverEvent;
  watchedCount: number;
  total: number;
  percent: number;
  complete: boolean;
  nextRow: number | null;
}

export interface HeroProfile {
  rank: RankTier;
  nextRank: RankTier | null;
  xp: number;
  rankProgress: number;
  streak: number;
  bestStreak: number;
  achievements: AchievementState[];
  unlockedCount: number;
  activeCrossover: CrossoverProgress | null;
  continuityPercent: number;
}

export interface XpGain {
  base: number;
  bonus: number;
  total: number;
  reasons: string[];
}

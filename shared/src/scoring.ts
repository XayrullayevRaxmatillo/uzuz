import type { PointMode } from './constants';

export const MAX_STREAK_BONUS = 500;
export const STREAK_STEP = 100;

/** 1000 points for an instant answer, linearly down to 500 at the last moment. */
export function basePoints(responseMs: number, timeLimitMs: number): number {
  if (timeLimitMs <= 0) return 500;
  const ratio = Math.min(Math.max(responseMs / timeLimitMs, 0), 1);
  return Math.round(1000 * (1 - ratio / 2));
}

export interface ScoreInput {
  correct: boolean;
  responseMs: number;
  timeLimitMs: number;
  streakBefore: number;
  pointsMode: PointMode;
}

export interface ScoreResult {
  base: number;
  streakBonus: number;
  total: number;
  /** Streak after this answer. */
  streak: number;
}

export function scoreAnswer(input: ScoreInput): ScoreResult {
  if (!input.correct) return { base: 0, streakBonus: 0, total: 0, streak: 0 };
  const streak = input.streakBefore + 1;
  if (input.pointsMode === 'none') return { base: 0, streakBonus: 0, total: 0, streak };
  const multiplier = input.pointsMode === 'double' ? 2 : 1;
  const base = basePoints(input.responseMs, input.timeLimitMs) * multiplier;
  const streakBonus = Math.min((streak - 1) * STREAK_STEP, MAX_STREAK_BONUS);
  return { base, streakBonus, total: base + streakBonus, streak };
}

export function levelFromXp(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 50)) + 1;
}

export function xpForLevel(level: number): number {
  return 50 * Math.pow(Math.max(1, level) - 1, 2);
}

export function levelProgress(xp: number): { level: number; current: number; next: number; ratio: number } {
  const level = levelFromXp(xp);
  const current = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return { level, current, next, ratio: next > current ? (xp - current) / (next - current) : 0 };
}

export interface XpInput {
  score: number;
  rank: number;
  playerCount: number;
  eligible: boolean;
}

export function xpForGame({ score, rank, playerCount, eligible }: XpInput): number {
  if (!eligible) return 0;
  const winBonus = rank === 1 && playerCount >= 2 ? 50 : 0;
  return Math.floor(Math.max(0, score) / 100) + 10 + winBonus;
}

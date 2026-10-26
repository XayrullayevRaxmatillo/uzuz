import { SKILL_LEVELS } from './constants';

export interface MatchPrefs {
  subject?: string;
  language?: string;
  level?: string;
}

export interface MatchCandidate {
  subject: string;
  language: string;
  level: string;
  capacity: number;
  memberCount: number;
  lastActiveAt: Date | string | number;
}

export type MatchReason = 'subject' | 'language' | 'level' | 'active' | 'spots';

export interface MatchResult {
  score: number;
  reasons: MatchReason[];
}

const WEIGHTS = { subject: 0.4, language: 0.25, level: 0.2, capacityActivity: 0.15 };
const WEEK_HOURS = 24 * 7;

function levelIndex(level: string | undefined): number {
  return SKILL_LEVELS.indexOf(level as (typeof SKILL_LEVELS)[number]);
}

/** Score 0..1 of how well a team fits the requested preferences. Full teams score -1. */
export function matchScore(prefs: MatchPrefs, team: MatchCandidate, now = Date.now()): MatchResult {
  const free = team.capacity - team.memberCount;
  if (free <= 0) return { score: -1, reasons: [] };

  const reasons: MatchReason[] = [];

  let subject = 0.5;
  if (prefs.subject) {
    subject = team.subject === prefs.subject ? 1 : 0;
    if (subject === 1) reasons.push('subject');
  }

  let language = 0.5;
  if (prefs.language) {
    language = team.language === prefs.language ? 1 : 0;
    if (language === 1) reasons.push('language');
  }

  let level = 0.5;
  const wanted = levelIndex(prefs.level);
  const actual = levelIndex(team.level);
  if (wanted >= 0 && actual >= 0) {
    level = 1 - Math.abs(wanted - actual) / 2;
    if (level === 1) reasons.push('level');
  }

  const hoursSince = (now - new Date(team.lastActiveAt).getTime()) / 3_600_000;
  const activity = Math.min(Math.max(1 - hoursSince / WEEK_HOURS, 0), 1);
  const freeRatio = Math.min(1, (free / team.capacity) * 2);
  const capacityActivity = 0.5 * freeRatio + 0.5 * activity;
  if (activity > 0.85) reasons.push('active');
  if (free >= 2) reasons.push('spots');

  const score =
    WEIGHTS.subject * subject +
    WEIGHTS.language * language +
    WEIGHTS.level * level +
    WEIGHTS.capacityActivity * capacityActivity;

  return { score: Math.round(score * 1000) / 1000, reasons };
}

export function rankTeams<T extends MatchCandidate>(
  prefs: MatchPrefs,
  teams: T[],
  limit = 5,
  now = Date.now()
): Array<{ team: T } & MatchResult> {
  return teams
    .map((team) => ({ team, ...matchScore(prefs, team, now) }))
    .filter((r) => r.score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

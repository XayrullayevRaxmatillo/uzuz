import { describe, expect, it } from 'vitest';
import {
  basePoints,
  scoreAnswer,
  levelFromXp,
  xpForGame,
  matchScore,
  rankTeams,
  generateRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
  normalizeTeamCode,
  slugify,
  nicknameSchema,
  questionSchema,
  quizInputSchema,
  containsProfanity,
  ROOM_CODE_ALPHABET
} from '../src/index';

describe('scoring', () => {
  it('gives 1000 for an instant answer and 500 at the deadline', () => {
    expect(basePoints(0, 20000)).toBe(1000);
    expect(basePoints(20000, 20000)).toBe(500);
    expect(basePoints(10000, 20000)).toBe(750);
    expect(basePoints(99999, 20000)).toBe(500);
  });

  it('applies streak bonus capped at 500', () => {
    let streak = 0;
    const totals: number[] = [];
    for (let i = 0; i < 8; i++) {
      const r = scoreAnswer({ correct: true, responseMs: 0, timeLimitMs: 10000, streakBefore: streak, pointsMode: 'standard' });
      streak = r.streak;
      totals.push(r.streakBonus);
    }
    expect(totals).toEqual([0, 100, 200, 300, 400, 500, 500, 500]);
  });

  it('resets streak on wrong answer and doubles points', () => {
    expect(scoreAnswer({ correct: false, responseMs: 0, timeLimitMs: 10000, streakBefore: 4, pointsMode: 'standard' })).toEqual({
      base: 0,
      streakBonus: 0,
      total: 0,
      streak: 0
    });
    const d = scoreAnswer({ correct: true, responseMs: 0, timeLimitMs: 10000, streakBefore: 0, pointsMode: 'double' });
    expect(d.total).toBe(2000);
    const n = scoreAnswer({ correct: true, responseMs: 0, timeLimitMs: 10000, streakBefore: 2, pointsMode: 'none' });
    expect(n.total).toBe(0);
    expect(n.streak).toBe(3);
  });

  it('computes levels and xp', () => {
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(49)).toBe(1);
    expect(levelFromXp(50)).toBe(2);
    expect(levelFromXp(200)).toBe(3);
    expect(xpForGame({ score: 4560, rank: 1, playerCount: 4, eligible: true })).toBe(45 + 10 + 50);
    expect(xpForGame({ score: 4560, rank: 2, playerCount: 4, eligible: true })).toBe(55);
    expect(xpForGame({ score: 4560, rank: 1, playerCount: 4, eligible: false })).toBe(0);
  });
});

describe('matching', () => {
  const now = Date.parse('2026-10-26T12:00:00Z');
  const base = { capacity: 5, memberCount: 2, lastActiveAt: now };
  it('prefers subject + language + level matches', () => {
    const perfect = matchScore({ subject: 'it', language: 'uz', level: 'beginner' }, { ...base, subject: 'it', language: 'uz', level: 'beginner' }, now);
    const partial = matchScore({ subject: 'it', language: 'uz', level: 'beginner' }, { ...base, subject: 'math', language: 'uz', level: 'advanced' }, now);
    expect(perfect.score).toBeGreaterThan(partial.score);
    expect(perfect.reasons).toContain('subject');
    expect(perfect.reasons).toContain('language');
    expect(perfect.reasons).toContain('level');
  });

  it('excludes full teams and returns top N', () => {
    const teams = [
      { id: 1, ...base, subject: 'it', language: 'uz', level: 'beginner', memberCount: 5 },
      { id: 2, ...base, subject: 'it', language: 'ru', level: 'beginner' },
      { id: 3, ...base, subject: 'it', language: 'uz', level: 'beginner' }
    ];
    const ranked = rankTeams({ subject: 'it', language: 'uz' }, teams, 5, now);
    expect(ranked.map((r) => r.team.id)).toEqual([3, 2]);
  });
});

describe('codes', () => {
  it('generates valid unambiguous room codes', () => {
    let seed = 7;
    const rand = (max: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % max;
    };
    for (let i = 0; i < 200; i++) {
      const code = generateRoomCode(rand);
      expect(code).toHaveLength(6);
      expect(isValidRoomCode(code)).toBe(true);
      expect(code).not.toMatch(/[01OI]/);
    }
    expect(ROOM_CODE_ALPHABET).toHaveLength(32);
  });

  it('normalizes user input', () => {
    expect(normalizeRoomCode(' ab-c 2d3 ')).toBe('ABC2D3');
    expect(normalizeTeamCode('t-abc234')).toBe('T-ABC234');
    expect(normalizeTeamCode('abc234')).toBe('T-ABC234');
  });

  it('slugifies latin and cyrillic', () => {
    expect(slugify('O‘zbekiston tarixi!')).toBe('ozbekiston-tarixi');
    expect(slugify('Столицы мира')).toBe('stolitsy-mira');
    expect(slugify('***')).toBe('quiz');
  });
});

describe('schemas', () => {
  it('validates nicknames', () => {
    expect(nicknameSchema.safeParse('Lochin_482').success).toBe(true);
    expect(nicknameSchema.safeParse('  G‘ayrat  ').data).toBe('G‘ayrat');
    expect(nicknameSchema.safeParse('Алишер').success).toBe(true);
    expect(nicknameSchema.safeParse('a').success).toBe(false);
    expect(nicknameSchema.safeParse('admin').success).toBe(false);
    expect(nicknameSchema.safeParse('<script>').success).toBe(false);
    expect(nicknameSchema.safeParse('fuckboy').success).toBe(false);
  });

  it('does not flag innocent words', () => {
    expect(containsProfanity('Klassik musiqa')).toBe(false);
    expect(containsProfanity('Assalom')).toBe(false);
  });

  it('requires exactly one correct option', () => {
    const q = {
      type: 'single',
      text: '2+2?',
      options: [
        { text: '3', correct: false },
        { text: '4', correct: true }
      ],
      timeLimit: 20,
      points: 'standard'
    };
    expect(questionSchema.safeParse(q).success).toBe(true);
    expect(questionSchema.safeParse({ ...q, options: q.options.map((o) => ({ ...o, correct: true })) }).success).toBe(false);
    expect(questionSchema.safeParse({ ...q, timeLimit: 7 }).success).toBe(false);
    expect(questionSchema.safeParse({ ...q, isCorrect: true }).success).toBe(false);
  });

  it('applies quiz defaults', () => {
    const r = quizInputSchema.parse({
      title: 'Test quiz',
      category: 'math',
      language: 'uz',
      difficulty: 'easy',
      questions: [
        {
          type: 'boolean',
          text: 'Yer yumaloqmi?',
          options: [
            { text: 'Ha', correct: true },
            { text: 'Yo‘q', correct: false }
          ],
          timeLimit: 10,
          points: 'standard'
        }
      ]
    });
    expect(r.visibility).toBe('public');
    expect(r.tags).toEqual([]);
    expect(r.questions[0].explanation).toBe('');
  });
});

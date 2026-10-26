export const LANGS = ['uz', 'ru', 'en'] as const;
export type Lang = (typeof LANGS)[number];

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const SKILL_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
export type SkillLevel = (typeof SKILL_LEVELS)[number];

export const CATEGORY_SLUGS = ['it', 'math', 'english', 'science', 'history', 'geography', 'general'] as const;
export type CategorySlug = (typeof CATEGORY_SLUGS)[number];

export const TIME_LIMITS = [5, 10, 20, 30, 60] as const;
export type TimeLimit = (typeof TIME_LIMITS)[number];

export const POINT_MODES = ['standard', 'double', 'none'] as const;
export type PointMode = (typeof POINT_MODES)[number];

export const QUESTION_TYPES = ['single', 'boolean'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const QUIZ_VISIBILITY = ['public', 'unlisted'] as const;
export type QuizVisibility = (typeof QUIZ_VISIBILITY)[number];

export const ROOM_MODES = ['classic', 'team', 'solo'] as const;
export type RoomMode = (typeof ROOM_MODES)[number];

export const TIME_MULTIPLIERS = [0.5, 1, 1.5, 2] as const;

export const TEAM_VISIBILITY = ['public', 'private'] as const;
export const TEAM_JOIN_POLICIES = ['open', 'approval', 'invite'] as const;
export type TeamJoinPolicy = (typeof TEAM_JOIN_POLICIES)[number];

/** Unambiguous alphabet: no 0/O, 1/I. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 6;
export const TEAM_CODE_LENGTH = 6;

export const AVATAR_COUNT = 24;
export const AVATAR_COLORS = [
  '#7C3AED',
  '#4F46E5',
  '#22D3EE',
  '#FF6B6B',
  '#22C55E',
  '#F59E0B',
  '#EC4899',
  '#14B8A6'
] as const;

/** Four answer slots: color + shape so color is never the only cue. */
export const ANSWER_STYLES = [
  { key: 'a', color: '#FF6B6B', shape: 'diamond' },
  { key: 'b', color: '#4F7BFF', shape: 'circle' },
  { key: 'c', color: '#F5B731', shape: 'triangle' },
  { key: 'd', color: '#1FBF8F', shape: 'square' }
] as const;

export const COLOR_TEAMS = [
  { key: 'color:coral', color: '#FF6B6B' },
  { key: 'color:cyan', color: '#22D3EE' },
  { key: 'color:violet', color: '#8B5CF6' },
  { key: 'color:amber', color: '#F59E0B' }
] as const;

export const PHASES = ['LOBBY', 'COUNTDOWN', 'QUESTION', 'REVEAL', 'LEADERBOARD', 'FINISHED'] as const;
export type Phase = (typeof PHASES)[number];

export const COUNTDOWN_MS = 3000;
export const REVEAL_MS = 4000;
export const LEADERBOARD_AUTO_MS = 5000;
export const ANSWER_GRACE_MS = 300;
export const LOBBY_DISCONNECT_GRACE_MS = 60_000;

export const MAX_PLAYERS_DEFAULT = 100;
export const MAX_PLAYERS_LIMIT = 200;
export const TEAM_CAPACITY_MIN = 2;
export const TEAM_CAPACITY_MAX = 10;
export const MAX_TEAMS_PER_SESSION = 3;
export const QUIZ_MAX_QUESTIONS = 50;
export const MIN_PLAYERS_FOR_XP = 3;
export const DAILY_XP_CAP = 2000;

export const BADGES = [
  'first_game',
  'first_win',
  'streak_5',
  'perfect',
  'games_10',
  'team_player',
  'quiz_creator'
] as const;
export type Badge = (typeof BADGES)[number];

export const REPORT_REASONS = ['inappropriate', 'wrong_answers', 'spam', 'offensive_name', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const ERROR_CODES = [
  'BAD_REQUEST',
  'VALIDATION',
  'NOT_FOUND',
  'RATE_LIMITED',
  'SESSION_REQUIRED',
  'FORBIDDEN',
  'INTERNAL',
  'ROOM_NOT_FOUND',
  'ROOM_FULL',
  'ROOM_LOCKED',
  'ROOM_FINISHED',
  'KICKED',
  'NO_PLAYERS',
  'NOT_HOST',
  'NOT_PLAYER',
  'INVALID_PHASE',
  'ALREADY_ANSWERED',
  'TOO_LATE',
  'WRONG_QUESTION',
  'NICKNAME_INVALID',
  'NICKNAME_TAKEN',
  'QUIZ_NOT_FOUND',
  'EDIT_FORBIDDEN',
  'IMAGE_INVALID',
  'TEAM_NOT_FOUND',
  'TEAM_FULL',
  'TEAM_ALREADY_MEMBER',
  'TEAM_NOT_MEMBER',
  'TEAM_LIMIT',
  'TEAM_INVITE_REQUIRED',
  'TEAM_INVALID_CODE',
  'TEAM_NOT_OWNER',
  'TEAM_REQUEST_PENDING',
  'TEAM_CAPACITY_TOO_LOW',
  'RESTORE_INVALID',
  'ADMIN_AUTH'
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

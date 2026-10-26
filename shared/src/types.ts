import type { ErrorCode, Lang, Phase, PointMode, QuestionType, RoomMode } from './constants';
import type { RoomSettings } from './schemas';

export type Ack<T = undefined> = { ok: true; data: T } | { ok: false; code: ErrorCode; suggestion?: string };

export interface PublicPlayer {
  pid: string;
  nickname: string;
  avatar: number;
  color: number;
  teamKey: string | null;
  connected: boolean;
  score: number;
  isHost: boolean;
}

export interface TeamOption {
  key: string;
  /** Display name. Color teams send '' and the client translates by key. */
  name: string;
  color: string | null;
  teamId: string | null;
}

export interface RoomStatePayload {
  code: string;
  phase: Phase;
  mode: RoomMode;
  quiz: { id: string; title: string; questionCount: number; language: Lang };
  settings: RoomSettings;
  locked: boolean;
  hostConnected: boolean;
  autoMode: boolean;
  questionIndex: number;
  serverNow: number;
  teams: TeamOption[];
  /** Personalized */
  isHost: boolean;
  you: { pid: string; isPlayer: boolean; teamKey: string | null } | null;
}

export interface CountdownPayload {
  index: number;
  total: number;
  endsAt: number;
}

export interface QuestionPayload {
  index: number;
  total: number;
  type: QuestionType;
  text: string;
  image: string | null;
  options: { text: string }[];
  /** Effective seconds after the room's time multiplier. */
  timeLimit: number;
  points: PointMode;
  startedAt: number;
  endsAt: number;
  /** Personalized: option already chosen by this player (reconnect). */
  answered: number | null;
}

export interface YouReveal {
  answered: boolean;
  option: number | null;
  correct: boolean;
  points: number;
  streakBonus: number;
  score: number;
  rank: number;
  streak: number;
}

export interface RevealPayload {
  index: number;
  total: number;
  correctOption: number;
  distribution: number[];
  answeredCount: number;
  playerCount: number;
  explanation: string;
  you: YouReveal | null;
}

export interface LeaderboardEntry {
  pid: string;
  nickname: string;
  avatar: number;
  color: number;
  score: number;
  correct: number;
  rank: number;
  prevRank: number | null;
  teamKey: string | null;
}

export interface TeamStanding {
  key: string;
  name: string;
  color: string | null;
  score: number;
  members: number;
  rank: number;
}

export interface LeaderboardPayload {
  index: number;
  total: number;
  isLast: boolean;
  entries: LeaderboardEntry[];
  teams: TeamStanding[];
  you: LeaderboardEntry | null;
}

export interface FinishedPayload {
  questionCount: number;
  playerCount: number;
  standings: LeaderboardEntry[];
  teams: TeamStanding[];
  you: (LeaderboardEntry & { accuracy: number; bestStreak: number }) | null;
}

export interface XpPayload {
  eligible: boolean;
  xpGained: number;
  totalXp: number;
  level: number;
  newBadges: string[];
}

export interface AnswerCountPayload {
  index: number;
  answered: number;
  total: number;
}

export type NoticeCode = 'HOST_DISCONNECTED' | 'HOST_RECONNECTED';

export interface ServerToClientEvents {
  'room:state': (p: RoomStatePayload) => void;
  'room:players': (p: { players: PublicPlayer[] }) => void;
  'room:answerCount': (p: AnswerCountPayload) => void;
  'room:kicked': (p: { code: string }) => void;
  'room:closed': (p: { code: string }) => void;
  'room:notice': (p: { code: NoticeCode }) => void;
  'game:countdown': (p: CountdownPayload) => void;
  'game:question': (p: QuestionPayload) => void;
  'game:reveal': (p: RevealPayload) => void;
  'game:leaderboard': (p: LeaderboardPayload) => void;
  'game:finished': (p: FinishedPayload) => void;
  'game:xp': (p: XpPayload) => void;
  'team:request': (p: { teamId: string; teamName: string; nickname: string }) => void;
  'team:requestResult': (p: { teamId: string; teamName: string; accepted: boolean }) => void;
}

type Cb<T = undefined> = (ack: Ack<T>) => void;

export interface ClientToServerEvents {
  'time:sync': (cb: (serverNow: number) => void) => void;
  'room:join': (
    p: { code: string; role: 'host' | 'player'; nickname?: string; avatar?: number; color?: number },
    cb: Cb<{ pid: string; isHost: boolean }>
  ) => void;
  'room:leave': (p: { code: string }, cb?: Cb) => void;
  'host:start': (p: { code: string }, cb: Cb) => void;
  'host:next': (p: { code: string }, cb: Cb) => void;
  'host:playAgain': (p: { code: string }, cb: Cb) => void;
  'host:kick': (p: { code: string; pid: string }, cb: Cb) => void;
  'host:lock': (p: { code: string; locked: boolean }, cb: Cb) => void;
  'answer:submit': (p: { code: string; questionIndex: number; option: number }, cb: Cb) => void;
  'team:select': (p: { code: string; teamKey: string }, cb: Cb) => void;
}

/* ---------- REST DTOs ---------- */

export interface ApiErrorBody {
  error: { code: ErrorCode; message: string; details?: unknown };
}

export interface CategoryDTO {
  slug: string;
  name: Record<Lang, string>;
  icon: string;
  color: string;
  quizCount: number;
}

export interface QuizCardDTO {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  language: Lang;
  difficulty: string;
  questionCount: number;
  plays: number;
  authorName: string;
  isOfficial: boolean;
  cover: string | null;
  createdAt: string;
}

export interface SessionDTO {
  pid: string;
  nickname: string | null;
  avatar: number;
  color: number;
  hideFromLeaderboard: boolean;
  createdAt: string;
  expiresAt: string;
  stats: {
    xp: number;
    level: number;
    games: number;
    wins: number;
    correct: number;
    answered: number;
    bestStreak: number;
    badges: string[];
  };
}

export interface TeamMemberDTO {
  pid: string;
  nickname: string;
  avatar: number;
  color: number;
  isOwner: boolean;
  online: boolean;
  joinedAt: string;
}

export interface TeamCardDTO {
  id: string;
  name: string;
  description: string;
  emoji: string;
  subject: string;
  language: Lang;
  level: string;
  capacity: number;
  memberCount: number;
  visibility: 'public' | 'private';
  joinPolicy: 'open' | 'approval' | 'invite';
  totalScore: number;
  gamesPlayed: number;
  lastActiveAt: string;
  members: Pick<TeamMemberDTO, 'pid' | 'nickname' | 'avatar' | 'color'>[];
}

import {
  ANSWER_GRACE_MS,
  COLOR_TEAMS,
  COUNTDOWN_MS,
  LEADERBOARD_AUTO_MS,
  LOBBY_DISCONNECT_GRACE_MS,
  MIN_PLAYERS_FOR_XP,
  REVEAL_MS,
  nicknameSchema,
  scoreAnswer,
  type Ack,
  type ErrorCode,
  type FinishedPayload,
  type Lang,
  type LeaderboardEntry,
  type LeaderboardPayload,
  type Phase,
  type PointMode,
  type PublicPlayer,
  type QuestionPayload,
  type QuestionType,
  type RevealPayload,
  type RoomMode,
  type RoomSettings,
  type RoomStatePayload,
  type TeamOption,
  type TeamStanding,
  type XpPayload,
  type ServerToClientEvents
} from '@uzuz/shared';

export interface EngineQuestion {
  type: QuestionType;
  text: string;
  image: string | null;
  options: { text: string; correct: boolean }[];
  timeLimit: number;
  points: PointMode;
  explanation: string;
}

export interface EngineQuiz {
  id: string;
  title: string;
  language: Lang;
  questions: EngineQuestion[];
}

type EventName = keyof ServerToClientEvents;
type EventPayload<E extends EventName> = Parameters<ServerToClientEvents[E]>[0];

/** Transport abstraction so the engine can be tested without sockets. */
export interface Outbox {
  room<E extends EventName>(event: E, payload: EventPayload<E>): void;
  session<E extends EventName>(sessionId: string, event: E, payload: EventPayload<E>): void;
  /** Remove a session's sockets from the room (after kick). */
  evict(sessionId: string): void;
}

export interface Scheduler {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export const realScheduler: Scheduler = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>)
};

interface AnswerRecord {
  option: number;
  correct: boolean;
  points: number;
  streakBonus: number;
  ms: number;
}

interface Player {
  sessionId: string;
  pid: string;
  nickname: string;
  avatar: number;
  color: number;
  teamKey: string | null;
  score: number;
  streak: number;
  bestStreak: number;
  correct: number;
  totalMs: number;
  answers: Map<number, AnswerRecord>;
  connected: boolean;
  joinedAt: number;
  disconnectedAt: number | null;
  prevRank: number | null;
}

export interface FinishedPlayerResult {
  sessionId: string;
  pid: string;
  nickname: string;
  avatar: number;
  color: number;
  score: number;
  correct: number;
  answered: number;
  bestStreak: number;
  rank: number;
  teamKey: string | null;
}

export interface FinishedGame {
  code: string;
  quizId: string;
  quizTitle: string;
  mode: RoomMode;
  questionCount: number;
  startedAt: number;
  finishedAt: number;
  eligible: boolean;
  players: FinishedPlayerResult[];
  teams: (TeamStanding & { teamId: string | null })[];
}

export interface GameRoomOptions {
  code: string;
  quiz: EngineQuiz;
  mode: RoomMode;
  settings: RoomSettings;
  hostSessionId: string;
  hostPid: string;
  outbox: Outbox;
  scheduler?: Scheduler;
  random?: () => number;
  onFinished?: (game: FinishedGame) => Promise<Map<string, XpPayload> | void> | Map<string, XpPayload> | void;
  onPhaseChange?: (phase: Phase) => void;
}

export interface JoinProfile {
  nickname?: string;
  avatar?: number;
  color?: number;
}

type Result<T = undefined> = Ack<T>;
const ok = <T>(data: T): Result<T> => ({ ok: true, data });
const fail = (code: ErrorCode, suggestion?: string): { ok: false; code: ErrorCode; suggestion?: string } =>
  suggestion ? { ok: false, code, suggestion } : { ok: false, code };

export class GameRoom {
  readonly code: string;
  readonly quiz: EngineQuiz;
  readonly mode: RoomMode;
  readonly settings: RoomSettings;
  readonly hostSessionId: string;
  readonly hostPid: string;
  readonly createdAt: number;

  phase: Phase = 'LOBBY';
  locked = false;
  hostConnections = 0;
  lastActivity: number;

  private players = new Map<string, Player>();
  private kicked = new Set<string>();
  private teams = new Map<string, TeamOption>();
  private order: number[] = [];
  private perms: number[][] = [];
  private index = 0;
  private questionStartedAt = 0;
  private questionEndsAt = 0;
  private phaseEndsAt = 0;
  private gameStartedAt = 0;
  private timer: unknown = null;
  private lobbySweeps = new Map<string, unknown>();
  private lastFinished: FinishedGame | null = null;
  private xpResults = new Map<string, XpPayload>();
  private destroyed = false;

  private readonly outbox: Outbox;
  private readonly clock: Scheduler;
  private readonly random: () => number;
  private readonly onFinished?: GameRoomOptions['onFinished'];
  private readonly onPhaseChange?: GameRoomOptions['onPhaseChange'];

  constructor(opts: GameRoomOptions) {
    this.code = opts.code;
    this.quiz = opts.quiz;
    this.mode = opts.mode;
    this.settings = opts.mode === 'solo' ? { ...opts.settings, maxPlayers: 1, autoAdvance: true, isPublic: false } : opts.settings;
    this.hostSessionId = opts.hostSessionId;
    this.hostPid = opts.hostPid;
    this.outbox = opts.outbox;
    this.clock = opts.scheduler ?? realScheduler;
    this.random = opts.random ?? Math.random;
    this.onFinished = opts.onFinished;
    this.onPhaseChange = opts.onPhaseChange;
    this.createdAt = this.clock.now();
    this.lastActivity = this.createdAt;
    if (this.mode === 'team') {
      for (const t of COLOR_TEAMS) this.teams.set(t.key, { key: t.key, name: '', color: t.color, teamId: null });
    }
  }

  /* ------------------------------------------------------------------ */
  /* Queries                                                             */
  /* ------------------------------------------------------------------ */

  get playerCount(): number {
    return this.players.size;
  }

  get connectedPlayerCount(): number {
    let n = 0;
    for (const p of this.players.values()) if (p.connected) n++;
    return n;
  }

  get hostConnected(): boolean {
    return this.hostConnections > 0;
  }

  /** Auto-advance when configured, in solo, or when the host is away. */
  get autoMode(): boolean {
    if (this.mode === 'solo') return true;
    return this.settings.autoAdvance || !this.hostConnected;
  }

  get currentIndex(): number {
    return this.index;
  }

  isHost(sessionId: string): boolean {
    return sessionId === this.hostSessionId;
  }

  isPlayer(sessionId: string): boolean {
    return this.players.has(sessionId);
  }

  hasTeam(key: string): boolean {
    return this.teams.has(key);
  }

  getLastFinished(): FinishedGame | null {
    return this.lastFinished;
  }

  publicPlayers(): PublicPlayer[] {
    return [...this.players.values()]
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .map((p) => ({
        pid: p.pid,
        nickname: p.nickname,
        avatar: p.avatar,
        color: p.color,
        teamKey: p.teamKey,
        connected: p.connected,
        score: p.score,
        isHost: p.sessionId === this.hostSessionId
      }));
  }

  stateFor(sessionId: string): RoomStatePayload {
    const player = this.players.get(sessionId);
    return {
      code: this.code,
      phase: this.phase,
      mode: this.mode,
      quiz: { id: this.quiz.id, title: this.quiz.title, questionCount: this.quiz.questions.length, language: this.quiz.language },
      settings: this.settings,
      locked: this.locked,
      hostConnected: this.hostConnected,
      autoMode: this.autoMode,
      questionIndex: this.index,
      serverNow: this.clock.now(),
      teams: [...this.teams.values()],
      isHost: this.isHost(sessionId),
      you: player ? { pid: player.pid, isPlayer: true, teamKey: player.teamKey } : this.isHost(sessionId) ? { pid: this.hostPid, isPlayer: false, teamKey: null } : null
    };
  }

  /* ------------------------------------------------------------------ */
  /* Membership                                                          */
  /* ------------------------------------------------------------------ */

  attachHost(sessionId: string): Result {
    if (!this.isHost(sessionId)) return fail('NOT_HOST');
    const wasAway = !this.hostConnected;
    this.hostConnections++;
    this.touch();
    if (wasAway && this.phase !== 'LOBBY' && this.phase !== 'FINISHED' && this.mode !== 'solo') {
      this.outbox.room('room:notice', { code: 'HOST_RECONNECTED' });
      this.broadcastState();
    }
    return ok(undefined);
  }

  detachHost(sessionId: string): void {
    if (!this.isHost(sessionId) || this.hostConnections === 0) return;
    this.hostConnections--;
    if (this.hostConnections === 0 && this.mode !== 'solo' && this.phase !== 'LOBBY' && this.phase !== 'FINISHED') {
      this.outbox.room('room:notice', { code: 'HOST_DISCONNECTED' });
      this.broadcastState();
      // If the room is waiting on the host at the leaderboard, keep the game moving.
      if (this.phase === 'LEADERBOARD' && !this.timer) {
        this.setPhaseTimer(LEADERBOARD_AUTO_MS, () => this.advanceFromLeaderboard());
      }
    }
  }

  join(sessionId: string, pid: string, profile: JoinProfile): Result<{ pid: string; reconnected: boolean }> {
    if (this.destroyed) return fail('ROOM_NOT_FOUND');
    if (this.kicked.has(sessionId)) return fail('KICKED');

    const existing = this.players.get(sessionId);
    if (existing) {
      existing.connected = true;
      existing.disconnectedAt = null;
      this.cancelLobbySweep(sessionId);
      this.touch();
      this.broadcastPlayers();
      return ok({ pid: existing.pid, reconnected: true });
    }

    if (this.mode === 'solo' && !this.isHost(sessionId)) return fail('ROOM_FULL');
    if (this.phase === 'FINISHED') return fail('ROOM_FINISHED');
    if (this.locked) return fail('ROOM_LOCKED');
    if (this.players.size >= this.settings.maxPlayers) return fail('ROOM_FULL');

    const parsed = nicknameSchema.safeParse(profile.nickname ?? '');
    if (!parsed.success) return fail('NICKNAME_INVALID');
    const nickname = parsed.data;
    if (this.nicknameTaken(nickname)) return fail('NICKNAME_TAKEN', this.suggestNickname(nickname));

    this.players.set(sessionId, {
      sessionId,
      pid,
      nickname,
      avatar: profile.avatar ?? 0,
      color: profile.color ?? 0,
      teamKey: null,
      score: 0,
      streak: 0,
      bestStreak: 0,
      correct: 0,
      totalMs: 0,
      answers: new Map(),
      connected: true,
      joinedAt: this.clock.now(),
      disconnectedAt: null,
      prevRank: null
    });
    // Late joiners in team mode are balanced into a color team right away.
    if (this.mode === 'team' && this.phase !== 'LOBBY') this.autoAssignTeam(this.players.get(sessionId)!);
    this.touch();
    this.broadcastPlayers();
    return ok({ pid, reconnected: false });
  }

  setDisconnected(sessionId: string): void {
    const p = this.players.get(sessionId);
    if (!p) return;
    p.connected = false;
    p.disconnectedAt = this.clock.now();
    this.broadcastPlayers();
    if (this.phase === 'LOBBY') {
      // Remove ghosts from the lobby after a grace period.
      const h = this.clock.setTimeout(() => {
        this.lobbySweeps.delete(sessionId);
        const cur = this.players.get(sessionId);
        if (cur && !cur.connected && this.phase === 'LOBBY') {
          this.players.delete(sessionId);
          this.broadcastPlayers();
        }
      }, LOBBY_DISCONNECT_GRACE_MS);
      this.lobbySweeps.set(sessionId, h);
    }
    if (this.phase === 'QUESTION') this.maybeEndEarly();
  }

  leave(sessionId: string): void {
    const p = this.players.get(sessionId);
    if (!p) return;
    if (this.phase === 'LOBBY') {
      this.players.delete(sessionId);
      this.cancelLobbySweep(sessionId);
      this.broadcastPlayers();
    } else {
      this.setDisconnected(sessionId);
    }
  }

  kick(bySession: string, pid: string): Result {
    if (!this.isHost(bySession)) return fail('NOT_HOST');
    const target = [...this.players.values()].find((p) => p.pid === pid);
    if (!target) return fail('NOT_PLAYER');
    if (target.sessionId === this.hostSessionId) return fail('FORBIDDEN');
    this.players.delete(target.sessionId);
    this.kicked.add(target.sessionId);
    this.cancelLobbySweep(target.sessionId);
    this.outbox.session(target.sessionId, 'room:kicked', { code: this.code });
    this.outbox.evict(target.sessionId);
    this.broadcastPlayers();
    if (this.phase === 'QUESTION') this.maybeEndEarly();
    return ok(undefined);
  }

  setLocked(bySession: string, locked: boolean): Result {
    if (!this.isHost(bySession)) return fail('NOT_HOST');
    this.locked = locked;
    this.broadcastState();
    return ok(undefined);
  }

  addTeamOption(option: TeamOption): void {
    if (this.mode !== 'team') return;
    if (!this.teams.has(option.key)) {
      this.teams.set(option.key, option);
      this.broadcastState();
    }
  }

  selectTeam(sessionId: string, teamKey: string): Result {
    if (this.mode !== 'team') return fail('INVALID_PHASE');
    if (this.phase !== 'LOBBY') return fail('INVALID_PHASE');
    const p = this.players.get(sessionId);
    if (!p) return fail('NOT_PLAYER');
    if (!this.teams.has(teamKey)) return fail('TEAM_NOT_FOUND');
    p.teamKey = teamKey;
    this.broadcastPlayers();
    this.outbox.session(sessionId, 'room:state', this.stateFor(sessionId));
    return ok(undefined);
  }

  /* ------------------------------------------------------------------ */
  /* Game flow                                                           */
  /* ------------------------------------------------------------------ */

  start(bySession: string): Result {
    if (!this.isHost(bySession)) return fail('NOT_HOST');
    if (this.phase !== 'LOBBY') return fail('INVALID_PHASE');
    if (this.players.size === 0) return fail('NO_PLAYERS');

    for (const p of this.players.values()) this.resetPlayer(p);
    if (this.mode === 'team') {
      for (const p of this.players.values()) if (!p.teamKey) this.autoAssignTeam(p);
    }
    for (const [sid, h] of this.lobbySweeps) {
      this.clock.clearTimeout(h);
      this.lobbySweeps.delete(sid);
    }

    const n = this.quiz.questions.length;
    this.order = [...Array(n).keys()];
    if (this.settings.shuffleQuestions) this.shuffle(this.order);
    this.perms = this.order.map((qi) => {
      const perm = [...this.quiz.questions[qi].options.keys()];
      if (this.settings.shuffleAnswers && this.quiz.questions[qi].type !== 'boolean') this.shuffle(perm);
      return perm;
    });
    this.index = 0;
    this.gameStartedAt = this.clock.now();
    this.xpResults.clear();
    this.broadcastPlayers();
    this.beginCountdown();
    return ok(undefined);
  }

  next(bySession: string): Result {
    if (!this.isHost(bySession)) return fail('NOT_HOST');
    switch (this.phase) {
      case 'QUESTION':
        this.endQuestion();
        return ok(undefined);
      case 'REVEAL':
        this.showLeaderboard();
        return ok(undefined);
      case 'LEADERBOARD':
        this.advanceFromLeaderboard();
        return ok(undefined);
      default:
        return fail('INVALID_PHASE');
    }
  }

  playAgain(bySession: string): Result {
    if (!this.isHost(bySession)) return fail('NOT_HOST');
    if (this.phase !== 'FINISHED') return fail('INVALID_PHASE');
    this.clearTimer();
    for (const p of this.players.values()) {
      this.resetPlayer(p);
      if (!p.connected) this.players.delete(p.sessionId);
    }
    this.lastFinished = null;
    this.setPhase('LOBBY');
    this.broadcastState();
    this.broadcastPlayers();
    return ok(undefined);
  }

  submitAnswer(sessionId: string, questionIndex: number, option: number): Result {
    const p = this.players.get(sessionId);
    if (!p) return fail('NOT_PLAYER');
    if (this.phase !== 'QUESTION') {
      return this.phase === 'REVEAL' && questionIndex === this.index ? fail('TOO_LATE') : fail('INVALID_PHASE');
    }
    if (questionIndex !== this.index) return fail('WRONG_QUESTION');
    const now = this.clock.now();
    if (now > this.questionEndsAt + ANSWER_GRACE_MS) return fail('TOO_LATE');
    if (p.answers.has(this.index)) return fail('ALREADY_ANSWERED');

    const q = this.currentQuestion();
    const perm = this.perms[this.index];
    if (!Number.isInteger(option) || option < 0 || option >= perm.length) return fail('BAD_REQUEST');

    const correct = q.options[perm[option]].correct;
    const timeLimitMs = this.questionEndsAt - this.questionStartedAt;
    const ms = Math.min(Math.max(now - this.questionStartedAt, 0), timeLimitMs);
    const scored = scoreAnswer({ correct, responseMs: ms, timeLimitMs, streakBefore: p.streak, pointsMode: q.points });

    p.answers.set(this.index, { option, correct, points: scored.base, streakBonus: scored.streakBonus, ms });
    p.score += scored.total;
    p.streak = scored.streak;
    p.bestStreak = Math.max(p.bestStreak, p.streak);
    if (correct) p.correct++;
    p.totalMs += ms;
    this.touch();

    this.outbox.room('room:answerCount', { index: this.index, answered: this.answeredCount(), total: this.players.size });
    this.maybeEndEarly();
    return ok(undefined);
  }

  /** Re-send everything a (re)connecting session needs to render the current screen. */
  syncSession(sessionId: string): void {
    this.outbox.session(sessionId, 'room:state', this.stateFor(sessionId));
    this.outbox.session(sessionId, 'room:players', { players: this.publicPlayers() });
    switch (this.phase) {
      case 'COUNTDOWN':
        this.outbox.session(sessionId, 'game:countdown', { index: this.index, total: this.order.length, endsAt: this.phaseEndsAt });
        break;
      case 'QUESTION':
        this.outbox.session(sessionId, 'game:question', this.questionPayload(sessionId));
        this.outbox.session(sessionId, 'room:answerCount', { index: this.index, answered: this.answeredCount(), total: this.players.size });
        break;
      case 'REVEAL':
        this.outbox.session(sessionId, 'game:reveal', this.revealPayload(sessionId));
        break;
      case 'LEADERBOARD':
        this.outbox.session(sessionId, 'game:leaderboard', this.leaderboardPayload(sessionId));
        break;
      case 'FINISHED': {
        this.outbox.session(sessionId, 'game:finished', this.finishedPayload(sessionId));
        const xp = this.xpResults.get(sessionId);
        if (xp) this.outbox.session(sessionId, 'game:xp', xp);
        break;
      }
      default:
        break;
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.clearTimer();
    for (const h of this.lobbySweeps.values()) this.clock.clearTimeout(h);
    this.lobbySweeps.clear();
    this.outbox.room('room:closed', { code: this.code });
  }

  /* ------------------------------------------------------------------ */
  /* Internals                                                           */
  /* ------------------------------------------------------------------ */

  private beginCountdown(): void {
    this.setPhase('COUNTDOWN');
    this.phaseEndsAt = this.clock.now() + COUNTDOWN_MS;
    this.outbox.room('game:countdown', { index: this.index, total: this.order.length, endsAt: this.phaseEndsAt });
    this.broadcastState();
    this.setPhaseTimer(COUNTDOWN_MS, () => this.startQuestion());
  }

  private startQuestion(): void {
    const q = this.currentQuestion();
    const limitMs = Math.round(q.timeLimit * this.settings.timeMultiplier * 1000);
    this.questionStartedAt = this.clock.now();
    this.questionEndsAt = this.questionStartedAt + limitMs;
    this.setPhase('QUESTION');
    for (const p of this.players.values()) this.outbox.session(p.sessionId, 'game:question', this.questionPayload(p.sessionId));
    if (!this.isPlayer(this.hostSessionId)) this.outbox.session(this.hostSessionId, 'game:question', this.questionPayload(this.hostSessionId));
    this.outbox.room('room:answerCount', { index: this.index, answered: 0, total: this.players.size });
    this.setPhaseTimer(limitMs + ANSWER_GRACE_MS, () => this.endQuestion());
  }

  private endQuestion(): void {
    if (this.phase !== 'QUESTION') return;
    for (const p of this.players.values()) if (!p.answers.has(this.index)) p.streak = 0;
    this.setPhase('REVEAL');
    this.sendPersonal('game:reveal', (sid) => this.revealPayload(sid));
    this.setPhaseTimer(REVEAL_MS, () => this.showLeaderboard());
  }

  private showLeaderboard(): void {
    if (this.phase !== 'REVEAL') return;
    this.setPhase('LEADERBOARD');
    this.sendPersonal('game:leaderboard', (sid) => this.leaderboardPayload(sid));
    // Remember ranks so the next leaderboard can animate movement.
    for (const e of this.rankings()) {
      const p = this.findByPid(e.pid);
      if (p) p.prevRank = e.rank;
    }
    const isLast = this.index >= this.order.length - 1;
    if (isLast || this.autoMode) {
      this.setPhaseTimer(LEADERBOARD_AUTO_MS, () => this.advanceFromLeaderboard());
    } else {
      this.clearTimer();
    }
  }

  private advanceFromLeaderboard(): void {
    if (this.phase !== 'LEADERBOARD') return;
    if (this.index >= this.order.length - 1) {
      void this.finish();
      return;
    }
    this.index++;
    this.beginCountdown();
  }

  private async finish(): Promise<void> {
    this.clearTimer();
    this.setPhase('FINISHED');
    const standings = this.rankings();
    const teams = this.teamStandings();
    const answeredAll = [...this.players.values()].every((p) => p.answers.size === this.order.length);
    const eligible = this.mode === 'solo' ? answeredAll : this.players.size >= MIN_PLAYERS_FOR_XP;

    this.lastFinished = {
      code: this.code,
      quizId: this.quiz.id,
      quizTitle: this.quiz.title,
      mode: this.mode,
      questionCount: this.order.length,
      startedAt: this.gameStartedAt,
      finishedAt: this.clock.now(),
      eligible,
      players: standings.map((e) => {
        const p = this.findByPid(e.pid)!;
        return {
          sessionId: p.sessionId,
          pid: p.pid,
          nickname: p.nickname,
          avatar: p.avatar,
          color: p.color,
          score: p.score,
          correct: p.correct,
          answered: p.answers.size,
          bestStreak: p.bestStreak,
          rank: e.rank,
          teamKey: p.teamKey
        };
      }),
      teams: teams.map((t) => ({ ...t, teamId: this.teams.get(t.key)?.teamId ?? null }))
    };

    this.sendPersonal('game:finished', (sid) => this.finishedPayload(sid));
    this.broadcastState();

    if (this.onFinished) {
      try {
        const xp = await this.onFinished(this.lastFinished);
        if (xp) {
          this.xpResults = xp;
          for (const [sid, payload] of xp) this.outbox.session(sid, 'game:xp', payload);
        }
      } catch (err) {
        console.error(`[room ${this.code}] failed to persist results`, err);
      }
    }
  }

  private maybeEndEarly(): void {
    if (this.phase !== 'QUESTION') return;
    const active = [...this.players.values()].filter((p) => p.connected);
    if (active.length === 0) return;
    if (active.every((p) => p.answers.has(this.index))) {
      // Short delay so the last answer's ack arrives before the reveal.
      this.setPhaseTimer(400, () => this.endQuestion());
    }
  }

  private currentQuestion(): EngineQuestion {
    return this.quiz.questions[this.order[this.index]];
  }

  private answeredCount(): number {
    let n = 0;
    for (const p of this.players.values()) if (p.answers.has(this.index)) n++;
    return n;
  }

  private questionPayload(sessionId: string): QuestionPayload {
    const q = this.currentQuestion();
    const perm = this.perms[this.index];
    const answered = this.players.get(sessionId)?.answers.get(this.index)?.option ?? null;
    return {
      index: this.index,
      total: this.order.length,
      type: q.type,
      text: q.text,
      image: q.image,
      options: perm.map((oi) => ({ text: q.options[oi].text })),
      timeLimit: Math.round(q.timeLimit * this.settings.timeMultiplier),
      points: q.points,
      startedAt: this.questionStartedAt,
      endsAt: this.questionEndsAt,
      answered
    };
  }

  private revealPayload(sessionId: string): RevealPayload {
    const q = this.currentQuestion();
    const perm = this.perms[this.index];
    const distribution = perm.map(() => 0);
    for (const p of this.players.values()) {
      const a = p.answers.get(this.index);
      if (a) distribution[a.option]++;
    }
    const correctOption = perm.findIndex((oi) => q.options[oi].correct);
    const p = this.players.get(sessionId);
    let you: RevealPayload['you'] = null;
    if (p) {
      const a = p.answers.get(this.index);
      const rank = this.rankings().find((e) => e.pid === p.pid)?.rank ?? 0;
      you = {
        answered: !!a,
        option: a?.option ?? null,
        correct: a?.correct ?? false,
        points: a?.points ?? 0,
        streakBonus: a?.streakBonus ?? 0,
        score: p.score,
        rank,
        streak: p.streak
      };
    }
    return {
      index: this.index,
      total: this.order.length,
      correctOption,
      distribution,
      answeredCount: this.answeredCount(),
      playerCount: this.players.size,
      explanation: q.explanation,
      you
    };
  }

  private leaderboardPayload(sessionId: string): LeaderboardPayload {
    const ranking = this.rankings();
    const mine = this.players.get(sessionId);
    return {
      index: this.index,
      total: this.order.length,
      isLast: this.index >= this.order.length - 1,
      entries: ranking.slice(0, 10),
      teams: this.teamStandings(),
      you: mine ? ranking.find((e) => e.pid === mine.pid) ?? null : null
    };
  }

  private finishedPayload(sessionId: string): FinishedPayload {
    const ranking = this.rankings();
    const mine = this.players.get(sessionId);
    const entry = mine ? ranking.find((e) => e.pid === mine.pid) : undefined;
    return {
      questionCount: this.order.length,
      playerCount: this.players.size,
      standings: ranking.slice(0, 100),
      teams: this.teamStandings(),
      you:
        mine && entry
          ? {
              ...entry,
              accuracy: this.order.length ? Math.round((mine.correct / this.order.length) * 100) : 0,
              bestStreak: mine.bestStreak
            }
          : null
    };
  }

  private rankings(): LeaderboardEntry[] {
    const sorted = [...this.players.values()].sort(
      (a, b) => b.score - a.score || b.correct - a.correct || a.totalMs - b.totalMs || a.joinedAt - b.joinedAt
    );
    return sorted.map((p, i) => ({
      pid: p.pid,
      nickname: p.nickname,
      avatar: p.avatar,
      color: p.color,
      score: p.score,
      correct: p.correct,
      rank: i + 1,
      prevRank: p.prevRank,
      teamKey: p.teamKey
    }));
  }

  private teamStandings(): TeamStanding[] {
    if (this.mode !== 'team') return [];
    const groups = new Map<string, Player[]>();
    for (const p of this.players.values()) {
      if (!p.teamKey) continue;
      const list = groups.get(p.teamKey) ?? [];
      list.push(p);
      groups.set(p.teamKey, list);
    }
    const standings = [...groups.entries()].map(([key, members]) => {
      const team = this.teams.get(key);
      return {
        key,
        name: team?.name ?? '',
        color: team?.color ?? null,
        score: Math.round(members.reduce((s, m) => s + m.score, 0) / members.length),
        members: members.length,
        rank: 0
      };
    });
    standings.sort((a, b) => b.score - a.score);
    standings.forEach((t, i) => (t.rank = i + 1));
    return standings;
  }

  private autoAssignTeam(p: Player): void {
    const counts = new Map<string, number>();
    for (const t of COLOR_TEAMS) counts.set(t.key, 0);
    for (const other of this.players.values()) {
      if (other.teamKey && counts.has(other.teamKey)) counts.set(other.teamKey, counts.get(other.teamKey)! + 1);
    }
    let best: string = COLOR_TEAMS[0].key;
    for (const [key, n] of counts) if (n < counts.get(best)!) best = key;
    p.teamKey = best;
  }

  private sendPersonal<E extends 'game:reveal' | 'game:leaderboard' | 'game:finished'>(
    event: E,
    build: (sessionId: string) => EventPayload<E>
  ): void {
    for (const p of this.players.values()) this.outbox.session(p.sessionId, event, build(p.sessionId));
    if (!this.isPlayer(this.hostSessionId)) this.outbox.session(this.hostSessionId, event, build(this.hostSessionId));
  }

  private broadcastPlayers(): void {
    this.outbox.room('room:players', { players: this.publicPlayers() });
  }

  private broadcastState(): void {
    for (const p of this.players.values()) this.outbox.session(p.sessionId, 'room:state', this.stateFor(p.sessionId));
    if (!this.isPlayer(this.hostSessionId)) this.outbox.session(this.hostSessionId, 'room:state', this.stateFor(this.hostSessionId));
  }

  private resetPlayer(p: Player): void {
    p.score = 0;
    p.streak = 0;
    p.bestStreak = 0;
    p.correct = 0;
    p.totalMs = 0;
    p.answers.clear();
    p.prevRank = null;
  }

  private nicknameTaken(nickname: string): boolean {
    const lower = nickname.toLocaleLowerCase();
    for (const p of this.players.values()) if (p.nickname.toLocaleLowerCase() === lower) return true;
    return false;
  }

  private suggestNickname(nickname: string): string {
    const base = nickname.slice(0, 17);
    for (let i = 2; i < 100; i++) {
      const candidate = `${base} ${i}`;
      if (!this.nicknameTaken(candidate)) return candidate;
    }
    return `${base.slice(0, 14)} ${Math.floor(this.random() * 9000 + 1000)}`;
  }

  private findByPid(pid: string): Player | undefined {
    for (const p of this.players.values()) if (p.pid === pid) return p;
    return undefined;
  }

  private cancelLobbySweep(sessionId: string): void {
    const h = this.lobbySweeps.get(sessionId);
    if (h !== undefined) {
      this.clock.clearTimeout(h);
      this.lobbySweeps.delete(sessionId);
    }
  }

  private shuffle<T>(arr: T[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  private setPhase(phase: Phase): void {
    this.phase = phase;
    this.touch();
    this.onPhaseChange?.(phase);
  }

  private setPhaseTimer(ms: number, fn: () => void): void {
    this.clearTimer();
    this.timer = this.clock.setTimeout(() => {
      this.timer = null;
      if (!this.destroyed) fn();
    }, ms);
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      this.clock.clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private touch(): void {
    this.lastActivity = this.clock.now();
  }
}

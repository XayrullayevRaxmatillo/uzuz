import { useCallback, useEffect, useReducer, useRef } from 'react';
import type {
  Ack,
  AnswerCountPayload,
  CountdownPayload,
  ErrorCode,
  FinishedPayload,
  LeaderboardPayload,
  NoticeCode,
  PublicPlayer,
  QuestionPayload,
  RevealPayload,
  RoomStatePayload,
  XpPayload
} from '@uzuz/shared';
import { getSocket } from '../lib/socket';
import { api } from '../lib/api';
import { session as sessionStore } from '../lib/storage';
import { sfx } from '../lib/sound';

export interface JoinProfile {
  nickname?: string;
  avatar?: number;
  color?: number;
}

export interface GameState {
  connected: boolean;
  reconnecting: boolean;
  joinStatus: 'idle' | 'joining' | 'joined' | 'error';
  joinError: { code: ErrorCode; suggestion?: string } | null;
  pid: string | null;
  isHost: boolean;
  room: RoomStatePayload | null;
  players: PublicPlayer[];
  countdown: CountdownPayload | null;
  question: QuestionPayload | null;
  myAnswer: number | null;
  answerCount: AnswerCountPayload | null;
  reveal: RevealPayload | null;
  leaderboard: LeaderboardPayload | null;
  finished: FinishedPayload | null;
  xp: XpPayload | null;
  kicked: boolean;
  closed: boolean;
  notice: NoticeCode | null;
}

const initial: GameState = {
  connected: false,
  reconnecting: false,
  joinStatus: 'idle',
  joinError: null,
  pid: null,
  isHost: false,
  room: null,
  players: [],
  countdown: null,
  question: null,
  myAnswer: null,
  answerCount: null,
  reveal: null,
  leaderboard: null,
  finished: null,
  xp: null,
  kicked: false,
  closed: false,
  notice: null
};

type Action =
  | { type: 'connected'; value: boolean }
  | { type: 'joining' }
  | { type: 'joined'; pid: string; isHost: boolean }
  | { type: 'joinError'; code: ErrorCode; suggestion?: string }
  | { type: 'state'; payload: RoomStatePayload }
  | { type: 'players'; players: PublicPlayer[] }
  | { type: 'countdown'; payload: CountdownPayload }
  | { type: 'question'; payload: QuestionPayload }
  | { type: 'answered'; option: number }
  | { type: 'answerCount'; payload: AnswerCountPayload }
  | { type: 'reveal'; payload: RevealPayload }
  | { type: 'leaderboard'; payload: LeaderboardPayload }
  | { type: 'finished'; payload: FinishedPayload }
  | { type: 'xp'; payload: XpPayload }
  | { type: 'kicked' }
  | { type: 'closed' }
  | { type: 'notice'; code: NoticeCode | null };

function reducer(s: GameState, a: Action): GameState {
  switch (a.type) {
    case 'connected':
      return { ...s, connected: a.value, reconnecting: !a.value && s.joinStatus === 'joined' };
    case 'joining':
      return { ...s, joinStatus: 'joining', joinError: null };
    case 'joined':
      return { ...s, joinStatus: 'joined', joinError: null, pid: a.pid, isHost: a.isHost, kicked: false };
    case 'joinError':
      return { ...s, joinStatus: 'error', joinError: { code: a.code, suggestion: a.suggestion } };
    case 'state': {
      const next = { ...s, room: a.payload, isHost: a.payload.isHost };
      // Back to lobby (play again): clear the previous game's screens.
      if (a.payload.phase === 'LOBBY') {
        return { ...next, countdown: null, question: null, myAnswer: null, reveal: null, leaderboard: null, finished: null, xp: null, answerCount: null };
      }
      return next;
    }
    case 'players':
      return { ...s, players: a.players };
    case 'countdown':
      return { ...s, countdown: a.payload, room: s.room ? { ...s.room, phase: 'COUNTDOWN', questionIndex: a.payload.index } : s.room };
    case 'question':
      return {
        ...s,
        question: a.payload,
        myAnswer: a.payload.answered,
        reveal: null,
        room: s.room ? { ...s.room, phase: 'QUESTION', questionIndex: a.payload.index } : s.room
      };
    case 'answered':
      return { ...s, myAnswer: a.option };
    case 'answerCount':
      return { ...s, answerCount: a.payload };
    case 'reveal':
      return { ...s, reveal: a.payload, room: s.room ? { ...s.room, phase: 'REVEAL' } : s.room };
    case 'leaderboard':
      return { ...s, leaderboard: a.payload, room: s.room ? { ...s.room, phase: 'LEADERBOARD' } : s.room };
    case 'finished':
      return { ...s, finished: a.payload, room: s.room ? { ...s.room, phase: 'FINISHED' } : s.room };
    case 'xp':
      return { ...s, xp: a.payload };
    case 'kicked':
      return { ...s, kicked: true, joinStatus: 'idle' };
    case 'closed':
      return { ...s, closed: true };
    case 'notice':
      return { ...s, notice: a.code };
    default:
      return s;
  }
}

const storeKey = (code: string) => `uzuz_room_${code}`;

function emitAck<T>(event: string, payload: unknown): Promise<Ack<T>> {
  const socket = getSocket();
  return new Promise((resolve) => {
    let done = false;
    const timer = window.setTimeout(() => {
      if (!done) {
        done = true;
        resolve({ ok: false, code: 'INTERNAL' });
      }
    }, 8000);
    (socket as unknown as { emit: (e: string, p: unknown, cb: (a: Ack<T>) => void) => void }).emit(event, payload, (ack: Ack<T>) => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      resolve(ack);
    });
  });
}

/**
 * Client side of a live room. All game truth comes from the server; this hook only mirrors
 * events into state and re-joins automatically after reconnects or a page refresh.
 */
export function useGameRoom(code: string, role: 'host' | 'player', enabled = true) {
  const [state, dispatch] = useReducer(reducer, initial);
  const joinedProfile = useRef<JoinProfile | null>(null);

  const join = useCallback(
    async (profile: JoinProfile = {}): Promise<Ack<{ pid: string; isHost: boolean }>> => {
      dispatch({ type: 'joining' });
      const ack = await emitAck<{ pid: string; isHost: boolean }>('room:join', { code, role, ...profile });
      if (ack.ok) {
        joinedProfile.current = profile;
        sessionStore.set(storeKey(code), JSON.stringify({ role, profile }));
        dispatch({ type: 'joined', pid: ack.data.pid, isHost: ack.data.isHost });
      } else {
        dispatch({ type: 'joinError', code: ack.code, suggestion: ack.suggestion });
        if (ack.code === 'ROOM_NOT_FOUND' || ack.code === 'KICKED') sessionStore.remove(storeKey(code));
      }
      return ack;
    },
    [code, role]
  );

  useEffect(() => {
    if (!enabled) return;
    const socket = getSocket();

    const onConnect = () => {
      dispatch({ type: 'connected', value: true });
      // Transparent re-join after a dropped connection.
      if (joinedProfile.current) void join(joinedProfile.current);
    };
    const onDisconnect = () => dispatch({ type: 'connected', value: false });
    const onConnectError = async (err: Error) => {
      dispatch({ type: 'connected', value: false });
      if (err.message === 'SESSION_REQUIRED') {
        // Cookie missing/expired: create a fresh guest session and retry.
        try {
          await api('/session');
        } catch {
          /* ignore */
        }
        window.setTimeout(() => socket.connect(), 300);
      }
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('room:state', (p) => dispatch({ type: 'state', payload: p }));
    socket.on('room:players', (p) => dispatch({ type: 'players', players: p.players }));
    socket.on('room:answerCount', (p) => dispatch({ type: 'answerCount', payload: p }));
    socket.on('room:kicked', () => {
      sessionStore.remove(storeKey(code));
      joinedProfile.current = null;
      dispatch({ type: 'kicked' });
    });
    socket.on('room:closed', () => dispatch({ type: 'closed' }));
    socket.on('room:notice', (p) => dispatch({ type: 'notice', code: p.code }));
    socket.on('game:countdown', (p) => dispatch({ type: 'countdown', payload: p }));
    socket.on('game:question', (p) => {
      sfx.go();
      dispatch({ type: 'question', payload: p });
    });
    socket.on('game:reveal', (p) => {
      if (p.you) (p.you.correct ? sfx.correct : sfx.wrong)();
      dispatch({ type: 'reveal', payload: p });
    });
    socket.on('game:leaderboard', (p) => dispatch({ type: 'leaderboard', payload: p }));
    socket.on('game:finished', (p) => {
      if (p.you && p.you.rank <= 3) sfx.win();
      dispatch({ type: 'finished', payload: p });
    });
    socket.on('game:xp', (p) => dispatch({ type: 'xp', payload: p }));

    if (socket.connected) dispatch({ type: 'connected', value: true });
    else socket.connect();

    // Host always attaches; a player who refreshed re-joins with their stored profile.
    const stored = sessionStore.get(storeKey(code));
    const run = () => {
      if (role === 'host') void join({});
      else if (stored) {
        try {
          const parsed = JSON.parse(stored) as { role: string; profile: JoinProfile };
          if (parsed.role === role) void join(parsed.profile);
        } catch {
          /* ignore */
        }
      }
    };
    if (socket.connected) run();
    else socket.once('connect', run);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('connect', run);
      for (const e of [
        'room:state',
        'room:players',
        'room:answerCount',
        'room:kicked',
        'room:closed',
        'room:notice',
        'game:countdown',
        'game:question',
        'game:reveal',
        'game:leaderboard',
        'game:finished',
        'game:xp'
      ] as const) {
        socket.off(e);
      }
      if (joinedProfile.current) socket.emit('room:leave', { code });
      joinedProfile.current = null;
    };
  }, [code, role, enabled, join]);

  const answer = useCallback(
    async (option: number) => {
      if (!state.question || state.myAnswer !== null) return { ok: false, code: 'ALREADY_ANSWERED' } as Ack;
      dispatch({ type: 'answered', option });
      const ack = await emitAck<undefined>('answer:submit', { code, questionIndex: state.question.index, option });
      return ack;
    },
    [code, state.question, state.myAnswer]
  );

  const action = useCallback((event: 'host:start' | 'host:next' | 'host:playAgain') => emitAck<undefined>(event, { code }), [code]);
  const kick = useCallback((pid: string) => emitAck<undefined>('host:kick', { code, pid }), [code]);
  const lock = useCallback((locked: boolean) => emitAck<undefined>('host:lock', { code, locked }), [code]);
  const selectTeam = useCallback((teamKey: string) => emitAck<undefined>('team:select', { code, teamKey }), [code]);

  return { state, join, answer, start: () => action('host:start'), next: () => action('host:next'), playAgain: () => action('host:playAgain'), kick, lock, selectTeam };
}

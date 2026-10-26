import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { parse as parseCookie } from 'cookie';
import type { ZodTypeAny, z } from 'zod';
import {
  COLOR_TEAMS,
  answerSubmitSchema,
  codeOnlySchema,
  kickSchema,
  lockSchema,
  roomJoinSchema,
  teamSelectSchema,
  type Ack,
  type ClientToServerEvents,
  type ErrorCode,
  type ServerToClientEvents
} from '@uzuz/shared';
import mongoose from 'mongoose';
import { env } from '../config/env';
import { SESSION_COOKIE, findSessionByToken } from '../middleware/session';
import { games } from '../game/manager';
import type { Outbox } from '../game/engine';
import { presence } from '../services/presence';
import { GuestSession } from '../models/GuestSession';
import { Team } from '../models/Team';

interface SocketData {
  sessionId: string;
  pid: string;
  /** room codes this socket joined, with role */
  rooms: Map<string, 'host' | 'player'>;
  events: number[];
}

type UzuzSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
export type UzuzServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

const roomChannel = (code: string) => `r:${code}`;
const memberChannel = (code: string, sessionId: string) => `r:${code}:${sessionId}`;
export const sessionChannel = (sessionId: string) => `s:${sessionId}`;

// code|sessionId|role -> number of open sockets
const connections = new Map<string, number>();
const connKey = (code: string, sid: string, role: 'host' | 'player') => `${code}|${sid}|${role}`;

let ioRef: UzuzServer | null = null;
export function getIo(): UzuzServer | null {
  return ioRef;
}

const EVENT_WINDOW_MS = 5000;
const EVENT_LIMIT = 40;

function rateLimited(socket: UzuzSocket): boolean {
  const now = Date.now();
  const events = socket.data.events.filter((t) => now - t < EVENT_WINDOW_MS);
  events.push(now);
  socket.data.events = events;
  return events.length > EVENT_LIMIT;
}

const failAck = (code: ErrorCode): Ack<never> => ({ ok: false, code });

/** Validates payload with Zod, applies throttling, and always answers the ack exactly once. */
function on<S extends ZodTypeAny, R>(
  socket: UzuzSocket,
  event: keyof ClientToServerEvents,
  schema: S,
  handler: (payload: z.output<S>) => Promise<Ack<R>> | Ack<R>
): void {
  (socket as unknown as Socket).on(event, async (payload: unknown, cb?: unknown) => {
    const reply = typeof cb === 'function' ? (cb as (a: Ack<R>) => void) : () => undefined;
    if (rateLimited(socket)) return reply(failAck('RATE_LIMITED'));
    const parsed = schema.safeParse(payload);
    if (!parsed.success) return reply(failAck('BAD_REQUEST'));
    try {
      reply(await handler(parsed.data));
    } catch (err) {
      console.error(`[socket] ${String(event)} failed`, err);
      reply(failAck('INTERNAL'));
    }
  });
}

function createOutbox(io: UzuzServer, code: string): Outbox {
  return {
    room(event, payload) {
      (io.to(roomChannel(code)) as unknown as { emit: (e: string, p: unknown) => void }).emit(event, payload);
    },
    session(sessionId, event, payload) {
      (io.to(memberChannel(code, sessionId)) as unknown as { emit: (e: string, p: unknown) => void }).emit(event, payload);
    },
    evict(sessionId) {
      io.in(memberChannel(code, sessionId)).socketsLeave([roomChannel(code), memberChannel(code, sessionId)]);
      connections.delete(connKey(code, sessionId, 'player'));
      for (const s of io.sockets.sockets.values()) {
        const sock = s as UzuzSocket;
        if (sock.data.sessionId === sessionId) sock.data.rooms.delete(code);
      }
    }
  };
}

function leaveRoom(socket: UzuzSocket, code: string): void {
  const role = socket.data.rooms.get(code);
  if (!role) return;
  socket.data.rooms.delete(code);
  void socket.leave(roomChannel(code));
  void socket.leave(memberChannel(code, socket.data.sessionId));
  const key = connKey(code, socket.data.sessionId, role);
  const remaining = (connections.get(key) ?? 1) - 1;
  if (remaining > 0) {
    connections.set(key, remaining);
    return;
  }
  connections.delete(key);
  const room = games.get(code);
  if (!room) return;
  if (role === 'host') room.detachHost(socket.data.sessionId);
  else room.setDisconnected(socket.data.sessionId);
}

export function attachSockets(httpServer: HttpServer): UzuzServer {
  const io: UzuzServer = new Server(httpServer, {
    cors: { origin: env.clientOrigins, credentials: true },
    pingInterval: 20_000,
    pingTimeout: 20_000,
    maxHttpBufferSize: 16 * 1024
  });
  ioRef = io;

  games.init((code) => createOutbox(io, code));

  // Authenticate with the same httpOnly guest cookie used by the REST API.
  io.use(async (socket, next) => {
    try {
      const cookies = parseCookie(socket.handshake.headers.cookie ?? '');
      const session = await findSessionByToken(cookies[SESSION_COOKIE]);
      if (!session) return next(new Error('SESSION_REQUIRED'));
      socket.data.sessionId = session._id.toString();
      socket.data.pid = session.publicId;
      socket.data.rooms = new Map();
      socket.data.events = [];
      next();
    } catch (err) {
      next(err as Error);
    }
  });

  io.on('connection', (rawSocket) => {
    const socket = rawSocket as UzuzSocket;
    const sid = socket.data.sessionId;
    presence.connect(sid);
    void socket.join(sessionChannel(sid));

    socket.on('time:sync', (cb) => {
      if (typeof cb === 'function') cb(Date.now());
    });

    on(socket, 'room:join', roomJoinSchema, async (p) => {
      const room = games.get(p.code);
      if (!room) return failAck('ROOM_NOT_FOUND');

      if (p.role === 'host') {
        const res = room.attachHost(sid);
        if (!res.ok) return res;
      } else {
        const res = room.join(sid, socket.data.pid, { nickname: p.nickname, avatar: p.avatar, color: p.color });
        if (!res.ok) return res;
        // Remember the player's preferences server-side as well.
        if (!res.data.reconnected && p.nickname) {
          void GuestSession.updateOne(
            { _id: sid },
            { $set: { nickname: p.nickname.trim().slice(0, 20), avatar: p.avatar ?? 0, color: p.color ?? 0 } }
          ).catch(() => undefined);
        }
      }

      if (!socket.data.rooms.has(p.code)) {
        socket.data.rooms.set(p.code, p.role);
        await socket.join([roomChannel(p.code), memberChannel(p.code, sid)]);
        const key = connKey(p.code, sid, p.role);
        connections.set(key, (connections.get(key) ?? 0) + 1);
      }

      // Team mode: offer the player's real UZUZ teams as options.
      if (room.mode === 'team' && p.role === 'player') {
        const teams = await Team.find({ status: 'active', 'members.session': sid }).select('name emoji').lean();
        for (const t of teams) {
          room.addTeamOption({ key: `team:${t._id.toString()}`, name: `${t.emoji} ${t.name}`, color: null, teamId: t._id.toString() });
        }
      }

      room.syncSession(sid);
      return { ok: true, data: { pid: room.isHost(sid) && p.role === 'host' ? room.hostPid : socket.data.pid, isHost: room.isHost(sid) } };
    });

    on(socket, 'room:leave', codeOnlySchema, (p) => {
      const room = games.get(p.code);
      leaveRoom(socket, p.code);
      room?.leave(sid);
      return { ok: true, data: undefined };
    });

    on(socket, 'host:start', codeOnlySchema, (p) => {
      const room = games.get(p.code);
      if (!room) return failAck('ROOM_NOT_FOUND');
      return room.start(sid);
    });

    on(socket, 'host:next', codeOnlySchema, (p) => {
      const room = games.get(p.code);
      if (!room) return failAck('ROOM_NOT_FOUND');
      return room.next(sid);
    });

    on(socket, 'host:playAgain', codeOnlySchema, (p) => {
      const room = games.get(p.code);
      if (!room) return failAck('ROOM_NOT_FOUND');
      return room.playAgain(sid);
    });

    on(socket, 'host:kick', kickSchema, (p) => {
      const room = games.get(p.code);
      if (!room) return failAck('ROOM_NOT_FOUND');
      return room.kick(sid, p.pid);
    });

    on(socket, 'host:lock', lockSchema, (p) => {
      const room = games.get(p.code);
      if (!room) return failAck('ROOM_NOT_FOUND');
      return room.setLocked(sid, p.locked);
    });

    on(socket, 'answer:submit', answerSubmitSchema, (p) => {
      const room = games.get(p.code);
      if (!room) return failAck('ROOM_NOT_FOUND');
      if (socket.data.rooms.get(p.code) !== 'player') return failAck('NOT_PLAYER');
      return room.submitAnswer(sid, p.questionIndex, p.option);
    });

    on(socket, 'team:select', teamSelectSchema, async (p) => {
      const room = games.get(p.code);
      if (!room) return failAck('ROOM_NOT_FOUND');
      if (p.teamKey.startsWith('team:')) {
        const teamId = p.teamKey.slice(5);
        if (!mongoose.isValidObjectId(teamId)) return failAck('TEAM_NOT_FOUND');
        const team = await Team.findOne({ _id: teamId, status: 'active', 'members.session': sid }).select('name emoji').lean();
        if (!team) return failAck('TEAM_NOT_MEMBER');
        room.addTeamOption({ key: p.teamKey, name: `${team.emoji} ${team.name}`, color: null, teamId });
      } else if (!COLOR_TEAMS.some((t) => t.key === p.teamKey)) {
        return failAck('TEAM_NOT_FOUND');
      }
      return room.selectTeam(sid, p.teamKey);
    });

    socket.on('disconnect', () => {
      presence.disconnect(sid);
      for (const code of [...socket.data.rooms.keys()]) leaveRoom(socket, code);
    });
  });

  return io;
}

/** Real-time notification to every open tab of a guest session. */
export function notifySession<E extends keyof ServerToClientEvents>(
  sessionId: string,
  event: E,
  payload: Parameters<ServerToClientEvents[E]>[0]
): void {
  if (!ioRef) return;
  (ioRef.to(sessionChannel(sessionId)) as unknown as { emit: (e: string, p: unknown) => void }).emit(event, payload);
}

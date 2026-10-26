/**
 * End-to-end: real Express app + Socket.IO + embedded MongoDB, three player clients and a host.
 * Covers: guest sessions via cookie, room creation, joining, synchronized questions,
 * server-side scoring, forged/duplicate answers, reconnect with score intact.
 * The first run downloads a MongoDB binary (~100MB), so allow time.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { io as ioc, type Socket } from 'socket.io-client';
import * as mms from 'mongodb-memory-server-core';

const MongoMemoryServer = (mms as any).MongoMemoryServer ?? (mms as any).default.MongoMemoryServer;

let mem: { getUri(db?: string): string; stop(): Promise<unknown> };
let server: http.Server;
let base = '';
const sockets: Socket[] = [];

async function guest(): Promise<string> {
  const res = await fetch(`${base}/api/v1/session`);
  const setCookie = res.headers.get('set-cookie') ?? '';
  const m = /uzuz_sid=([^;]+)/.exec(setCookie);
  if (!m) throw new Error('no session cookie');
  return `uzuz_sid=${m[1]}`;
}

function connect(cookie: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = ioc(base, { transports: ['websocket'], extraHeaders: { cookie }, reconnection: false, forceNew: true });
    sockets.push(s);
    s.once('connect', () => resolve(s));
    s.once('connect_error', reject);
  });
}

function emit<T = any>(s: Socket, event: string, payload: unknown): Promise<T> {
  return new Promise((resolve) => s.emit(event, payload, (ack: T) => resolve(ack)));
}

function next<T = any>(s: Socket, event: string, timeout = 15000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeout);
    s.once(event, (p: T) => {
      clearTimeout(t);
      resolve(p);
    });
  });
}

beforeAll(async () => {
  mem = await MongoMemoryServer.create();
  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = mem.getUri('uzuz-test');
  process.env.CLIENT_URL = 'http://localhost:5173';
  const { connectDb } = await import('../src/config/db');
  const { bootstrap } = await import('../src/services/bootstrap');
  const { createApp } = await import('../src/app');
  const { attachSockets } = await import('../src/sockets');
  await connectDb();
  await bootstrap();
  server = http.createServer(createApp());
  attachSockets(server);
  await new Promise<void>((r) => server.listen(0, r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}, 180_000);

afterAll(async () => {
  for (const s of sockets) s.disconnect();
  const { games } = await import('../src/game/manager');
  games.shutdown();
  await new Promise<void>((r) => server.close(() => r()));
  const { disconnectDb } = await import('../src/config/db');
  await disconnectDb();
  await mem.stop();
});

describe('live game over sockets', () => {
  it('plays a synchronized question with server-side scoring and reconnect', async () => {
    // Seeded library is available without any account.
    const list = (await (await fetch(`${base}/api/v1/quizzes?limit=1`)).json()) as { items: { id: string }[] };
    expect(list.items.length).toBe(1);

    const hostCookie = await guest();
    const created = await fetch(`${base}/api/v1/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: hostCookie },
      body: JSON.stringify({ quizId: list.items[0].id, mode: 'classic', settings: {} })
    });
    expect(created.status).toBe(201);
    const { code } = (await created.json()) as { code: string };
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);

    const host = await connect(hostCookie);
    expect((await emit(host, 'room:join', { code, role: 'host' })).ok).toBe(true);

    const cookies = [await guest(), await guest(), await guest()];
    const players = await Promise.all(cookies.map(connect));
    const names = ['Ali', 'Vali', 'Gani'];
    for (const [i, p] of players.entries()) {
      const ack = await emit(p, 'room:join', { code, role: 'player', nickname: names[i], avatar: i, color: i });
      expect(ack.ok).toBe(true);
    }
    // Duplicate nickname is rejected with a suggestion.
    const extra = await connect(await guest());
    const dup = await emit(extra, 'room:join', { code, role: 'player', nickname: 'ali' });
    expect(dup).toEqual({ ok: false, code: 'NICKNAME_TAKEN', suggestion: 'ali 2' });

    // A player cannot start the game.
    expect((await emit(players[0], 'host:start', { code })).code).toBe('NOT_HOST');

    const questions = players.map((p) => next(p, 'game:question'));
    expect((await emit(host, 'host:start', { code })).ok).toBe(true);
    const qs = await Promise.all(questions);
    // Everyone gets the same question and deadline, without correctness flags.
    expect(new Set(qs.map((q) => q.endsAt)).size).toBe(1);
    expect(JSON.stringify(qs[0])).not.toMatch(/correct/);

    // Forged answers are rejected.
    expect((await emit(players[0], 'answer:submit', { code, questionIndex: 5, option: 0 })).code).toBe('WRONG_QUESTION');

    const reveals = players.map((p) => next(p, 'game:reveal'));
    const picks = [0, 1, 2];
    for (const [i, p] of players.entries()) {
      expect((await emit(p, 'answer:submit', { code, questionIndex: 0, option: picks[i] % qs[0].options.length })).ok).toBe(true);
    }
    expect((await emit(players[0], 'answer:submit', { code, questionIndex: 0, option: 1 })).code).toBe('ALREADY_ANSWERED');

    const rs = await Promise.all(reveals);
    const correct = rs[0].correctOption;
    for (const [i, r] of rs.entries()) {
      const chose = picks[i] % qs[0].options.length;
      expect(r.you.correct).toBe(chose === correct);
      if (chose === correct) expect(r.you.points).toBeGreaterThan(499);
      else expect(r.you.points).toBe(0);
    }
    const scoreBefore = rs[0].you.score;

    // Reconnect: player 0 drops and comes back with the same guest cookie.
    players[0].disconnect();
    const again = await connect(cookies[0]);
    const statePromise = next(again, 'room:state');
    const rejoin = await emit(again, 'room:join', { code, role: 'player', nickname: 'Anything' });
    expect(rejoin.ok).toBe(true);
    const state = await statePromise;
    expect(state.you.isPlayer).toBe(true);
    const lb = await next(host, 'game:leaderboard', 10000);
    const me = lb.entries.find((e: { nickname: string }) => e.nickname === 'Ali');
    expect(me.score).toBe(scoreBefore);
  }, 120_000);
});

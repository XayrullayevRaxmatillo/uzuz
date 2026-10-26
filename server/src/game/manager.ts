import { generateRoomCode, type RoomMode, type RoomSettings } from '@uzuz/shared';
import { GameRoom, type EngineQuiz, type Outbox } from './engine';
import { randomInt } from '../utils/crypto';
import { persistFinishedGame } from '../services/results';
import { Room } from '../models/Room';

const ROOM_IDLE_MS = 2 * 60 * 60 * 1000;
const FINISHED_IDLE_MS = 30 * 60 * 1000;
const SWEEP_EVERY_MS = 5 * 60 * 1000;

export type OutboxFactory = (code: string) => Outbox;

export interface PublicRoom {
  code: string;
  quizTitle: string;
  mode: RoomMode;
  players: number;
  maxPlayers: number;
  language: string;
}

class GameManager {
  private rooms = new Map<string, GameRoom>();
  private outboxFactory: OutboxFactory | null = null;
  private sweepTimer: ReturnType<typeof setInterval> | null = null;

  init(factory: OutboxFactory): void {
    this.outboxFactory = factory;
    this.sweepTimer = setInterval(() => void this.sweep(), SWEEP_EVERY_MS);
    this.sweepTimer.unref();
  }

  get(code: string): GameRoom | undefined {
    return this.rooms.get(code);
  }

  get size(): number {
    return this.rooms.size;
  }

  async create(opts: {
    quiz: EngineQuiz;
    mode: RoomMode;
    settings: RoomSettings;
    hostSessionId: string;
    hostPid: string;
  }): Promise<GameRoom> {
    if (!this.outboxFactory) throw new Error('GameManager not initialised');
    for (let attempt = 0; attempt < 20; attempt++) {
      const code = generateRoomCode(randomInt);
      if (this.rooms.has(code)) continue;
      try {
        await Room.create({
          code,
          quiz: opts.quiz.id,
          quizTitle: opts.quiz.title,
          mode: opts.mode,
          settings: opts.settings,
          hostSession: opts.hostSessionId,
          active: true,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        });
      } catch (err) {
        if ((err as { code?: number }).code === 11000) continue; // code collision with another active room
        throw err;
      }
      const room = new GameRoom({
        code,
        quiz: opts.quiz,
        mode: opts.mode,
        settings: opts.settings,
        hostSessionId: opts.hostSessionId,
        hostPid: opts.hostPid,
        outbox: this.outboxFactory(code),
        onFinished: (game) => persistFinishedGame(game),
        onPhaseChange: (phase) => {
          if (phase === 'COUNTDOWN' || phase === 'FINISHED') {
            void Room.updateOne({ code, active: true }, { $set: { phase, playerCount: room.playerCount } }).catch(() => undefined);
          }
        }
      });
      this.rooms.set(code, room);
      return room;
    }
    throw new Error('Could not allocate a room code');
  }

  /** Public lobbies that anyone can join from the Join page. */
  listPublic(): PublicRoom[] {
    const out: PublicRoom[] = [];
    for (const room of this.rooms.values()) {
      if (room.settings.isPublic && room.phase === 'LOBBY' && !room.locked && room.mode !== 'solo' && room.hostConnected) {
        out.push({
          code: room.code,
          quizTitle: room.quiz.title,
          mode: room.mode,
          players: room.playerCount,
          maxPlayers: room.settings.maxPlayers,
          language: room.quiz.language
        });
      }
    }
    return out.sort((a, b) => b.players - a.players).slice(0, 20);
  }

  stats() {
    let players = 0;
    let playing = 0;
    for (const r of this.rooms.values()) {
      players += r.connectedPlayerCount;
      if (r.phase !== 'LOBBY' && r.phase !== 'FINISHED') playing++;
    }
    return { rooms: this.rooms.size, playing, players };
  }

  async close(code: string): Promise<void> {
    const room = this.rooms.get(code);
    if (!room) return;
    room.destroy();
    this.rooms.delete(code);
    await Room.updateOne({ code, active: true }, { $set: { active: false } }).catch(() => undefined);
  }

  private async sweep(): Promise<void> {
    const now = Date.now();
    for (const room of [...this.rooms.values()]) {
      const idle = now - room.lastActivity;
      const nobody = room.connectedPlayerCount === 0 && !room.hostConnected;
      if (idle > ROOM_IDLE_MS || (room.phase === 'FINISHED' && idle > FINISHED_IDLE_MS && nobody)) {
        await this.close(room.code);
      }
    }
  }

  /** On boot no in-memory rooms exist, so any room marked active in DB is stale. */
  async deactivateStale(): Promise<void> {
    await Room.updateMany({ active: true }, { $set: { active: false } });
  }

  shutdown(): void {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
    for (const room of this.rooms.values()) room.destroy();
    this.rooms.clear();
  }
}

export const games = new GameManager();

import { describe, expect, it } from 'vitest';
import { GameRoom, type EngineQuiz, type Outbox, type Scheduler, type FinishedGame } from '../src/game/engine';
import { roomSettingsSchema } from '@uzuz/shared';

/** Deterministic clock + timer queue. */
class FakeClock implements Scheduler {
  t = 1_000_000;
  private seq = 0;
  private timers = new Map<number, { at: number; fn: () => void }>();
  now() {
    return this.t;
  }
  setTimeout(fn: () => void, ms: number) {
    const id = ++this.seq;
    this.timers.set(id, { at: this.t + ms, fn });
    return id;
  }
  clearTimeout(h: unknown) {
    this.timers.delete(h as number);
  }
  advance(ms: number) {
    const target = this.t + ms;
    for (;;) {
      let nextId: number | null = null;
      let nextAt = Infinity;
      for (const [id, tm] of this.timers) if (tm.at <= target && tm.at < nextAt) (nextAt = tm.at), (nextId = id);
      if (nextId === null) break;
      const tm = this.timers.get(nextId)!;
      this.timers.delete(nextId);
      this.t = tm.at;
      tm.fn();
    }
    this.t = target;
  }
}

class RecordingOutbox implements Outbox {
  roomEvents: { event: string; payload: any }[] = [];
  sessionEvents: { sid: string; event: string; payload: any }[] = [];
  evicted: string[] = [];
  room(event: any, payload: any) {
    this.roomEvents.push({ event, payload });
  }
  session(sid: string, event: any, payload: any) {
    this.sessionEvents.push({ sid, event, payload });
  }
  evict(sid: string) {
    this.evicted.push(sid);
  }
  last(sid: string, event: string) {
    for (let i = this.sessionEvents.length - 1; i >= 0; i--) {
      const e = this.sessionEvents[i];
      if (e.sid === sid && e.event === event) return e.payload;
    }
    return undefined;
  }
  count(sid: string, event: string) {
    return this.sessionEvents.filter((e) => e.sid === sid && e.event === event).length;
  }
}

const quiz: EngineQuiz = {
  id: 'q1',
  title: 'Test',
  language: 'uz',
  questions: [
    {
      type: 'single',
      text: '2+2?',
      image: null,
      options: [
        { text: '3', correct: false },
        { text: '4', correct: true },
        { text: '5', correct: false },
        { text: '22', correct: false }
      ],
      timeLimit: 10,
      points: 'standard',
      explanation: ''
    },
    {
      type: 'boolean',
      text: 'Yer yumaloq?',
      image: null,
      options: [
        { text: 'Ha', correct: true },
        { text: 'Yo‘q', correct: false }
      ],
      timeLimit: 20,
      points: 'double',
      explanation: 'Ha, deyarli shar.'
    }
  ]
};

function setup(mode: 'classic' | 'team' | 'solo' = 'classic', settings = {}) {
  const clock = new FakeClock();
  const out = new RecordingOutbox();
  let finished: FinishedGame | null = null;
  const room = new GameRoom({
    code: 'ABC234',
    quiz,
    mode,
    settings: roomSettingsSchema.parse(settings),
    hostSessionId: 'host',
    hostPid: 'hostpid',
    outbox: out,
    scheduler: clock,
    onFinished: (g) => {
      finished = g;
      return new Map(g.players.map((p) => [p.sessionId, { eligible: g.eligible, xpGained: 10, totalXp: 10, level: 1, newBadges: [] }]));
    }
  });
  room.attachHost('host');
  return { room, clock, out, getFinished: () => finished };
}

describe('GameRoom', () => {
  it('runs a full classic game with server-side scoring', async () => {
    const { room, clock, out, getFinished } = setup();
    expect(room.join('a', 'pa', { nickname: 'Ali', avatar: 1, color: 2 }).ok).toBe(true);
    expect(room.join('b', 'pb', { nickname: 'Vali' }).ok).toBe(true);
    expect(room.join('c', 'pc', { nickname: 'Gani' }).ok).toBe(true);

    expect(room.start('a')).toEqual({ ok: false, code: 'NOT_HOST' });
    expect(room.start('host').ok).toBe(true);
    expect(room.phase).toBe('COUNTDOWN');

    // Answers before the question opens are rejected.
    expect(room.submitAnswer('a', 0, 1)).toEqual({ ok: false, code: 'INVALID_PHASE' });

    clock.advance(3000);
    expect(room.phase).toBe('QUESTION');
    const qp = out.last('a', 'game:question');
    expect(qp.options).toHaveLength(4);
    expect(JSON.stringify(qp)).not.toMatch(/correct/);

    // Instant correct answer = 1000, half-time correct = 750, wrong = 0
    expect(room.submitAnswer('a', 0, 1).ok).toBe(true);
    expect(room.submitAnswer('a', 0, 1)).toEqual({ ok: false, code: 'ALREADY_ANSWERED' });
    clock.advance(5000);
    expect(room.submitAnswer('b', 0, 1).ok).toBe(true);
    expect(room.submitAnswer('c', 1, 0)).toEqual({ ok: false, code: 'WRONG_QUESTION' });
    expect(room.submitAnswer('c', 0, 0).ok).toBe(true);

    // All answered → reveal after short delay
    clock.advance(400);
    expect(room.phase).toBe('REVEAL');
    const ra = out.last('a', 'game:reveal');
    expect(ra.correctOption).toBe(1);
    expect(ra.distribution).toEqual([1, 2, 0, 0]);
    expect(ra.you.points).toBe(1000);
    expect(ra.you.rank).toBe(1);
    expect(out.last('b', 'game:reveal').you.points).toBe(750);
    expect(out.last('c', 'game:reveal').you.correct).toBe(false);
    // Host gets the generic reveal
    expect(out.last('host', 'game:reveal').you).toBeNull();

    clock.advance(4000);
    expect(room.phase).toBe('LEADERBOARD');
    const lb = out.last('host', 'game:leaderboard');
    expect(lb.entries.map((e: any) => e.nickname)).toEqual(['Ali', 'Vali', 'Gani']);
    expect(lb.isLast).toBe(false);

    // Host controls pacing: nothing happens without host:next
    clock.advance(20000);
    expect(room.phase).toBe('LEADERBOARD');
    expect(room.next('host').ok).toBe(true);
    expect(room.phase).toBe('COUNTDOWN');
    clock.advance(3000);
    expect(room.phase).toBe('QUESTION');

    // Q2 double points; c answers correct instantly; a answers late (no streak reset because a answers correct)
    expect(room.submitAnswer('c', 1, 0).ok).toBe(true);
    // Timeout for others
    clock.advance(20000 + 300 + 1);
    expect(room.phase).toBe('REVEAL');
    expect(out.last('c', 'game:reveal').you.points).toBe(2000);
    expect(out.last('a', 'game:reveal').you.streak).toBe(0);
    expect(room.submitAnswer('a', 1, 0)).toEqual({ ok: false, code: 'TOO_LATE' });

    clock.advance(4000);
    const lb2 = out.last('host', 'game:leaderboard');
    expect(lb2.isLast).toBe(true);
    expect(lb2.entries[0].nickname).toBe('Gani');
    expect(lb2.entries[0].prevRank).toBe(3);

    clock.advance(5000);
    await Promise.resolve();
    expect(room.phase).toBe('FINISHED');
    const fin = out.last('a', 'game:finished');
    expect(fin.you.accuracy).toBe(50);
    expect(fin.standings[0].nickname).toBe('Gani');
    expect(getFinished()!.eligible).toBe(true);
    expect(getFinished()!.players.map((p) => p.score)).toEqual([2000, 1000, 750]);
    await new Promise((r) => setTimeout(r, 0));
    expect(out.last('a', 'game:xp').xpGained).toBe(10);
  });

  it('handles nickname rules, lock, capacity and kick', () => {
    const { room, out } = setup('classic', { maxPlayers: 2 });
    expect(room.join('a', 'pa', { nickname: 'x' })).toEqual({ ok: false, code: 'NICKNAME_INVALID' });
    expect(room.join('a', 'pa', { nickname: 'Ali' }).ok).toBe(true);
    const dup = room.join('b', 'pb', { nickname: 'ali' });
    expect(dup).toEqual({ ok: false, code: 'NICKNAME_TAKEN', suggestion: 'ali 2' });
    expect(room.join('b', 'pb', { nickname: 'Bek' }).ok).toBe(true);
    expect(room.join('c', 'pc', { nickname: 'Cho' })).toEqual({ ok: false, code: 'ROOM_FULL' });

    expect(room.kick('a', 'pb')).toEqual({ ok: false, code: 'NOT_HOST' });
    expect(room.kick('host', 'pb').ok).toBe(true);
    expect(out.evicted).toEqual(['b']);
    expect(room.join('b', 'pb', { nickname: 'Bek' })).toEqual({ ok: false, code: 'KICKED' });

    expect(room.setLocked('host', true).ok).toBe(true);
    expect(room.join('d', 'pd', { nickname: 'Dilshod' })).toEqual({ ok: false, code: 'ROOM_LOCKED' });
  });

  it('reconnects a player with their score intact', () => {
    const { room, clock, out } = setup();
    room.join('a', 'pa', { nickname: 'Ali' });
    room.join('b', 'pb', { nickname: 'Bek' });
    room.start('host');
    clock.advance(3000);
    room.submitAnswer('a', 0, 1);
    room.setDisconnected('a');
    // b answers; a is disconnected so question ends early
    room.submitAnswer('b', 0, 0);
    clock.advance(400);
    expect(room.phase).toBe('REVEAL');
    const res = room.join('a', 'pa', { nickname: 'Whatever' });
    expect(res).toEqual({ ok: true, data: { pid: 'pa', reconnected: true } });
    room.syncSession('a');
    expect(out.last('a', 'game:reveal').you.score).toBe(1000);
    expect(out.last('a', 'room:state').phase).toBe('REVEAL');
  });

  it('removes disconnected players from the lobby after the grace period', () => {
    const { room, clock } = setup();
    room.join('a', 'pa', { nickname: 'Ali' });
    room.setDisconnected('a');
    clock.advance(59_000);
    expect(room.playerCount).toBe(1);
    clock.advance(2_000);
    expect(room.playerCount).toBe(0);
  });

  it('auto-advances when the host disconnects mid-game', () => {
    const { room, clock } = setup();
    room.join('a', 'pa', { nickname: 'Ali' });
    room.start('host');
    clock.advance(3000);
    room.submitAnswer('a', 0, 1);
    clock.advance(400 + 4000);
    expect(room.phase).toBe('LEADERBOARD');
    room.detachHost('host');
    expect(room.autoMode).toBe(true);
    clock.advance(5000);
    expect(room.phase).toBe('COUNTDOWN');
  });

  it('plays solo with auto-advance and only the host may join', async () => {
    const { room, clock, getFinished } = setup('solo');
    expect(room.join('x', 'px', { nickname: 'Other' })).toEqual({ ok: false, code: 'ROOM_FULL' });
    expect(room.join('host', 'hostpid', { nickname: 'Solo' }).ok).toBe(true);
    room.start('host');
    clock.advance(3000);
    room.submitAnswer('host', 0, 1);
    clock.advance(400 + 4000 + 5000 + 3000);
    expect(room.phase).toBe('QUESTION');
    room.submitAnswer('host', 1, 0);
    clock.advance(400 + 4000 + 5000);
    await Promise.resolve();
    expect(room.phase).toBe('FINISHED');
    expect(getFinished()!.eligible).toBe(true);
    expect(getFinished()!.players[0].score).toBe(1000 + 2000 + 100);
  });

  it('balances team mode and averages team scores', () => {
    const { room, clock, out } = setup('team');
    room.join('a', 'pa', { nickname: 'Ali' });
    room.join('b', 'pb', { nickname: 'Bek' });
    room.join('c', 'pc', { nickname: 'Cho' });
    expect(room.selectTeam('a', 'color:coral').ok).toBe(true);
    expect(room.selectTeam('b', 'color:coral').ok).toBe(true);
    expect(room.selectTeam('a', 'nope')).toEqual({ ok: false, code: 'TEAM_NOT_FOUND' });
    room.start('host');
    const players = room.publicPlayers();
    expect(players.find((p) => p.pid === 'pc')!.teamKey).toBe('color:cyan');
    clock.advance(3000);
    room.submitAnswer('a', 0, 1);
    room.submitAnswer('b', 0, 0);
    room.submitAnswer('c', 0, 1);
    clock.advance(400 + 4000);
    const teams = out.last('host', 'game:leaderboard').teams;
    expect(teams[0]).toEqual({ key: 'color:cyan', name: '', color: '#22D3EE', score: 1000, members: 1, rank: 1 });
    expect(teams[1].score).toBe(500);
  });

  it('shuffles answers but keeps correctness mapping', () => {
    let s = 3;
    const clock = new FakeClock();
    const out = new RecordingOutbox();
    const room = new GameRoom({
      code: 'ZZZ234',
      quiz,
      mode: 'classic',
      settings: roomSettingsSchema.parse({ shuffleAnswers: true }),
      hostSessionId: 'host',
      hostPid: 'hp',
      outbox: out,
      scheduler: clock,
      random: () => ((s = (s * 9301 + 49297) % 233280) / 233280)
    });
    room.join('a', 'pa', { nickname: 'Ali' });
    room.start('host');
    clock.advance(3000);
    const q = out.last('a', 'game:question');
    const correctDisplay = q.options.findIndex((o: any) => o.text === '4');
    room.submitAnswer('a', 0, correctDisplay);
    clock.advance(400);
    const r = out.last('a', 'game:reveal');
    expect(r.correctOption).toBe(correctDisplay);
    expect(r.you.correct).toBe(true);
  });
});

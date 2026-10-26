import mongoose from 'mongoose';
import { DAILY_XP_CAP, levelFromXp, xpForGame, type XpPayload } from '@uzuz/shared';
import type { FinishedGame } from '../game/engine';
import { GameResult } from '../models/GameResult';
import { PlayerStats } from '../models/PlayerStats';
import { Quiz } from '../models/Quiz';
import { Room } from '../models/Room';
import { Team } from '../models/Team';

function tashkentDay(date = new Date()): string {
  // Asia/Tashkent is UTC+5 without DST.
  return new Date(date.getTime() + 5 * 3_600_000).toISOString().slice(0, 10);
}

function computeBadges(
  existing: string[],
  p: FinishedGame['players'][number],
  game: FinishedGame,
  gamesAfter: number,
  winsAfter: number
): string[] {
  const has = new Set(existing);
  const earned: string[] = [];
  const add = (b: string) => {
    if (!has.has(b)) {
      has.add(b);
      earned.push(b);
    }
  };
  add('first_game');
  if (winsAfter >= 1) add('first_win');
  if (p.bestStreak >= 5) add('streak_5');
  if (game.questionCount >= 3 && p.correct === game.questionCount) add('perfect');
  if (gamesAfter >= 10) add('games_10');
  if (game.mode === 'team' && p.teamKey) add('team_player');
  return earned;
}

/**
 * Persist a finished game: GameResult, per-player stats/XP/badges, quiz play count,
 * real team rankings and room status. Returns XP payloads per session.
 */
export async function persistFinishedGame(game: FinishedGame): Promise<Map<string, XpPayload>> {
  const quiz = await Quiz.findById(game.quizId).select('slug').lean();
  const today = tashkentDay();
  const xpBySession = new Map<string, XpPayload>();
  const multiplayerWin = game.players.length >= 2;

  const participants: Array<Record<string, unknown>> = [];
  for (const p of game.players) {
    let stats = await PlayerStats.findOne({ session: p.sessionId });
    if (!stats) {
      stats = new PlayerStats({ session: p.sessionId, pid: p.pid, nickname: p.nickname, avatar: p.avatar, color: p.color });
    }
    let xp = xpForGame({ score: p.score, rank: p.rank, playerCount: game.players.length, eligible: game.eligible });
    if (stats.dailyXpDate !== today) {
      stats.dailyXpDate = today;
      stats.dailyXp = 0;
    }
    xp = Math.max(0, Math.min(xp, DAILY_XP_CAP - stats.dailyXp));

    const won = p.rank === 1 && multiplayerWin;
    stats.nickname = p.nickname;
    stats.avatar = p.avatar;
    stats.color = p.color;
    stats.dailyXp += xp;
    stats.xp += xp;
    stats.games += 1;
    if (won) stats.wins += 1;
    stats.correct += p.correct;
    stats.answered += game.questionCount;
    stats.bestStreak = Math.max(stats.bestStreak, p.bestStreak);
    stats.lastPlayedAt = new Date(game.finishedAt);
    const newBadges = computeBadges(stats.badges, p, game, stats.games, stats.wins);
    stats.badges.push(...newBadges);
    await stats.save();

    xpBySession.set(p.sessionId, {
      eligible: game.eligible,
      xpGained: xp,
      totalXp: stats.xp,
      level: levelFromXp(stats.xp),
      newBadges
    });

    const teamId = p.teamKey?.startsWith('team:') ? p.teamKey.slice(5) : null;
    participants.push({ ...p, session: p.sessionId, xp, teamId: teamId && mongoose.isValidObjectId(teamId) ? teamId : null });
  }

  await GameResult.create({
    roomCode: game.code,
    quiz: game.quizId,
    quizTitle: game.quizTitle,
    quizSlug: quiz?.slug ?? null,
    mode: game.mode,
    questionCount: game.questionCount,
    playerCount: game.players.length,
    eligible: game.eligible,
    startedAt: new Date(game.startedAt),
    finishedAt: new Date(game.finishedAt),
    players: participants,
    teams: game.teams.map((t) => ({ ...t, teamId: t.teamId && mongoose.isValidObjectId(t.teamId) ? t.teamId : null }))
  });

  await Quiz.updateOne({ _id: game.quizId }, { $inc: { plays: 1 } });
  await Room.updateOne(
    { code: game.code, active: true },
    { $set: { phase: 'FINISHED', finishedAt: new Date(game.finishedAt), playerCount: game.players.length } }
  );

  // Team rankings only count real UZUZ teams in eligible games.
  if (game.eligible) {
    for (const t of game.teams) {
      if (!t.teamId || !mongoose.isValidObjectId(t.teamId)) continue;
      await Team.updateOne(
        { _id: t.teamId },
        {
          $inc: { totalScore: t.score, gamesPlayed: 1, wins: t.rank === 1 && game.teams.length > 1 ? 1 : 0 },
          $set: { lastActiveAt: new Date() }
        }
      );
    }
  }

  return xpBySession;
}

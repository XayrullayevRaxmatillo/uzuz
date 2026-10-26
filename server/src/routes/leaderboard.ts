import { Router } from 'express';
import mongoose from 'mongoose';
import { levelFromXp } from '@uzuz/shared';
import { PlayerStats } from '../models/PlayerStats';
import { GameResult } from '../models/GameResult';
import { Team } from '../models/Team';
import { asyncHandler, clampInt, requireObjectId } from '../utils/http';

export const leaderboardRouter = Router();

/** Monday 00:00 in Asia/Tashkent (UTC+5, no DST), as a UTC Date. */
export function weekStart(now = new Date()): Date {
  const local = new Date(now.getTime() + 5 * 3_600_000);
  const day = (local.getUTCDay() + 6) % 7; // 0 = Monday
  const monday = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - day);
  return new Date(monday - 5 * 3_600_000);
}

const PAGE = 25;

leaderboardRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const scope = String(req.query.scope ?? 'global');
    const page = clampInt(req.query.page, 1, 200, 1);
    const sid = req.guest._id;

    if (scope === 'teams') {
      const filter = { status: 'active', hiddenByAdmin: false, gamesPlayed: { $gt: 0 } };
      const [items, total] = await Promise.all([
        Team.find(filter)
          .select('name emoji totalScore gamesPlayed wins memberCount capacity visibility subject')
          .sort({ totalScore: -1, wins: -1 })
          .skip((page - 1) * PAGE)
          .limit(PAGE)
          .lean(),
        Team.countDocuments(filter)
      ]);
      res.json({
        scope,
        page,
        pages: Math.ceil(total / PAGE),
        items: items.map((t, i) => ({
          rank: (page - 1) * PAGE + i + 1,
          id: t._id.toString(),
          name: t.visibility === 'private' ? null : t.name,
          emoji: t.emoji,
          score: t.totalScore,
          games: t.gamesPlayed,
          wins: t.wins,
          members: t.memberCount,
          subject: t.subject
        }))
      });
      return;
    }

    if (scope === 'weekly') {
      const since = weekStart();
      const rows = await GameResult.aggregate<{ _id: mongoose.Types.ObjectId; xp: number; score: number; games: number; nickname: string; avatar: number; color: number }>([
        { $match: { finishedAt: { $gte: since }, eligible: true, flagged: false } },
        { $unwind: '$players' },
        { $sort: { finishedAt: -1 } },
        {
          $group: {
            _id: '$players.session',
            xp: { $sum: '$players.xp' },
            score: { $sum: '$players.score' },
            games: { $sum: 1 },
            nickname: { $first: '$players.nickname' },
            avatar: { $first: '$players.avatar' },
            color: { $first: '$players.color' }
          }
        },
        { $match: { xp: { $gt: 0 } } },
        { $sort: { xp: -1, score: -1 } },
        { $limit: 500 }
      ]);
      const hiddenSet = new Set(
        (await PlayerStats.find({ session: { $in: rows.map((r) => r._id) }, $or: [{ hidden: true }, { nameHidden: true }] }).select('session').lean()).map((s) =>
          s.session.toString()
        )
      );
      const visible = rows.filter((r) => !hiddenSet.has(r._id.toString()));
      const myIndex = visible.findIndex((r) => r._id.toString() === sid.toString());
      res.json({
        scope,
        page,
        since,
        pages: Math.ceil(visible.length / PAGE),
        items: visible.slice((page - 1) * PAGE, page * PAGE).map((r, i) => ({
          rank: (page - 1) * PAGE + i + 1,
          nickname: r.nickname,
          avatar: r.avatar,
          color: r.color,
          xp: r.xp,
          score: r.score,
          games: r.games,
          isYou: r._id.toString() === sid.toString()
        })),
        you: myIndex >= 0 ? { rank: myIndex + 1, xp: visible[myIndex].xp } : null
      });
      return;
    }

    if (scope === 'quiz') {
      const quizId = requireObjectId(req.query.quizId, 'QUIZ_NOT_FOUND');
      const rows = await GameResult.aggregate([
        { $match: { quiz: new mongoose.Types.ObjectId(quizId), flagged: false } },
        { $unwind: '$players' },
        { $sort: { 'players.score': -1 } },
        { $group: { _id: '$players.session', nickname: { $first: '$players.nickname' }, avatar: { $first: '$players.avatar' }, color: { $first: '$players.color' }, score: { $first: '$players.score' } } },
        { $sort: { score: -1 } },
        { $limit: 50 }
      ]);
      res.json({ scope, page: 1, pages: 1, items: rows.map((r, i) => ({ rank: i + 1, nickname: r.nickname, avatar: r.avatar, color: r.color, score: r.score, isYou: String(r._id) === sid.toString() })) });
      return;
    }

    // global (all-time XP)
    const filter = { hidden: false, nameHidden: false, xp: { $gt: 0 } };
    const [items, total, me] = await Promise.all([
      PlayerStats.find(filter).sort({ xp: -1, wins: -1 }).skip((page - 1) * PAGE).limit(PAGE).lean(),
      PlayerStats.countDocuments(filter),
      PlayerStats.findOne({ session: sid }).lean()
    ]);
    let you: { rank: number; xp: number } | null = null;
    if (me && !me.hidden && me.xp > 0) {
      const ahead = await PlayerStats.countDocuments({ ...filter, xp: { $gt: me.xp } });
      you = { rank: ahead + 1, xp: me.xp };
    }
    res.json({
      scope: 'global',
      page,
      pages: Math.ceil(total / PAGE),
      items: items.map((s, i) => ({
        rank: (page - 1) * PAGE + i + 1,
        nickname: s.nickname,
        avatar: s.avatar,
        color: s.color,
        xp: s.xp,
        level: levelFromXp(s.xp),
        games: s.games,
        wins: s.wins,
        accuracy: s.answered ? Math.round((s.correct / s.answered) * 100) : 0,
        badges: s.badges.length,
        isYou: s.session.toString() === sid.toString()
      })),
      you
    });
  })
);

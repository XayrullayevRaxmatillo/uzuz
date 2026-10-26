import { Router } from 'express';
import { z } from 'zod';
import { levelFromXp, sessionUpdateSchema, type SessionDTO } from '@uzuz/shared';
import { GuestSession, SESSION_TTL_MS, type GuestSessionDoc } from '../models/GuestSession';
import { PlayerStats } from '../models/PlayerStats';
import { GameResult } from '../models/GameResult';
import { Team } from '../models/Team';
import { asyncHandler, ApiError, parse } from '../utils/http';
import { newRestoreCode, newToken, normalizeRestoreCode, sha256 } from '../utils/crypto';
import { setSessionCookie } from '../middleware/session';
import { actionLimiter, ipLimiter } from '../middleware/rateLimit';

export const sessionRouter = Router();

export async function sessionDto(session: GuestSessionDoc): Promise<SessionDTO> {
  const stats = await PlayerStats.findOne({ session: session._id }).lean();
  const xp = stats?.xp ?? 0;
  return {
    pid: session.publicId,
    nickname: session.nickname ?? null,
    avatar: session.avatar,
    color: session.color,
    hideFromLeaderboard: session.hideFromLeaderboard,
    createdAt: (session as unknown as { createdAt: Date }).createdAt.toISOString(),
    expiresAt: session.expiresAt.toISOString(),
    stats: {
      xp,
      level: levelFromXp(xp),
      games: stats?.games ?? 0,
      wins: stats?.wins ?? 0,
      correct: stats?.correct ?? 0,
      answered: stats?.answered ?? 0,
      bestStreak: stats?.bestStreak ?? 0,
      badges: stats?.badges ?? []
    }
  };
}

sessionRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await sessionDto(req.guest));
  })
);

sessionRouter.patch(
  '/',
  actionLimiter(30, 60_000),
  asyncHandler(async (req, res) => {
    const body = parse(sessionUpdateSchema, req.body);
    const s = req.guest;
    if (body.nickname !== undefined) s.nickname = body.nickname;
    if (body.avatar !== undefined) s.avatar = body.avatar;
    if (body.color !== undefined) s.color = body.color;
    if (body.hideFromLeaderboard !== undefined) s.hideFromLeaderboard = body.hideFromLeaderboard;
    await s.save();

    // Keep mirrors in sync for leaderboards and team member lists.
    const mirror: Record<string, unknown> = { avatar: s.avatar, color: s.color, hidden: s.hideFromLeaderboard };
    if (s.nickname) mirror.nickname = s.nickname;
    await PlayerStats.updateOne({ session: s._id }, { $set: mirror });
    if (s.nickname) {
      await Team.updateMany(
        { 'members.session': s._id },
        { $set: { 'members.$[m].nickname': s.nickname, 'members.$[m].avatar': s.avatar, 'members.$[m].color': s.color } },
        { arrayFilters: [{ 'm.session': s._id }] }
      );
    }
    res.json(await sessionDto(s));
  })
);

/** One-time code that lets the user move this guest session to another device. */
sessionRouter.post(
  '/restore-code',
  actionLimiter(5, 60 * 60_000),
  asyncHandler(async (req, res) => {
    const code = newRestoreCode();
    req.guest.restoreCodeHash = sha256(code);
    await req.guest.save();
    res.json({ code });
  })
);

sessionRouter.post(
  '/restore',
  ipLimiter(10, 15 * 60_000),
  asyncHandler(async (req, res) => {
    const { code } = parse(z.object({ code: z.string().min(8).max(20) }).strict(), req.body);
    const target = await GuestSession.findOne({ restoreCodeHash: sha256(normalizeRestoreCode(code)) });
    if (!target || target.expiresAt.getTime() < Date.now()) throw new ApiError(404, 'RESTORE_INVALID');
    // Rotate: the restored session gets a fresh token; the code is single-use.
    const token = newToken();
    target.tokenHash = sha256(token);
    target.restoreCodeHash = null;
    target.lastSeenAt = new Date();
    target.expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await target.save();
    setSessionCookie(res, token);
    res.json(await sessionDto(target));
  })
);

sessionRouter.get(
  '/history',
  asyncHandler(async (req, res) => {
    const results = await GameResult.find({ 'players.session': req.guest._id })
      .sort({ finishedAt: -1 })
      .limit(20)
      .lean();
    const sid = req.guest._id.toString();
    res.json({
      items: results.map((r) => {
        const me = r.players.find((p) => p.session.toString() === sid)!;
        return {
          roomCode: r.roomCode,
          quizTitle: r.quizTitle,
          quizSlug: r.quizSlug,
          mode: r.mode,
          finishedAt: r.finishedAt,
          playerCount: r.playerCount,
          questionCount: r.questionCount,
          score: me.score,
          rank: me.rank,
          correct: me.correct,
          xp: me.xp
        };
      })
    });
  })
);

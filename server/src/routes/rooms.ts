import { Router } from 'express';
import { isValidRoomCode, normalizeRoomCode, roomCreateSchema } from '@uzuz/shared';
import { Quiz } from '../models/Quiz';
import { GameResult } from '../models/GameResult';
import { PlayerStats } from '../models/PlayerStats';
import { games } from '../game/manager';
import type { EngineQuiz } from '../game/engine';
import { asyncHandler, notFound, parse } from '../utils/http';
import { actionLimiter, ipLimiter } from '../middleware/rateLimit';

export const roomsRouter = Router();

roomsRouter.post(
  '/',
  actionLimiter(30, 60 * 60_000),
  asyncHandler(async (req, res) => {
    const body = parse(roomCreateSchema, req.body);
    const quiz = await Quiz.findOne({ _id: body.quizId, hidden: false }).lean();
    if (!quiz) throw notFound('QUIZ_NOT_FOUND');

    const engineQuiz: EngineQuiz = {
      id: quiz._id.toString(),
      title: quiz.title,
      language: quiz.language,
      questions: quiz.questions.map((q) => ({
        type: q.type,
        text: q.text,
        image: q.image ?? null,
        options: q.options.map((o) => ({ text: o.text, correct: o.correct })),
        timeLimit: q.timeLimit,
        points: q.points ?? 'standard',
        explanation: q.explanation ?? ''
      }))
    };

    const room = await games.create({
      quiz: engineQuiz,
      mode: body.mode,
      settings: body.settings,
      hostSessionId: req.guest._id.toString(),
      hostPid: req.guest.publicId
    });
    res.status(201).json({ code: room.code, mode: room.mode });
  })
);

roomsRouter.get(
  '/public',
  asyncHandler(async (_req, res) => {
    res.json({ items: games.listPublic() });
  })
);

// Anti brute-force for code guessing.
roomsRouter.get(
  '/:code',
  ipLimiter(30, 60_000),
  asyncHandler(async (req, res) => {
    const code = normalizeRoomCode(String(req.params.code));
    if (!isValidRoomCode(code)) throw notFound('ROOM_NOT_FOUND');
    const room = games.get(code);
    if (!room) throw notFound('ROOM_NOT_FOUND');
    const sid = req.guest._id.toString();
    res.json({
      code: room.code,
      phase: room.phase,
      mode: room.mode,
      quizTitle: room.quiz.title,
      questionCount: room.quiz.questions.length,
      language: room.quiz.language,
      playerCount: room.playerCount,
      maxPlayers: room.settings.maxPlayers,
      locked: room.locked,
      isHost: room.isHost(sid),
      isPlayer: room.isPlayer(sid)
    });
  })
);

roomsRouter.get(
  '/:code/results',
  asyncHandler(async (req, res) => {
    const code = normalizeRoomCode(String(req.params.code));
    if (!isValidRoomCode(code)) throw notFound('ROOM_NOT_FOUND');
    const result = await GameResult.findOne({ roomCode: code }).sort({ finishedAt: -1 }).lean();
    if (!result) throw notFound('NOT_FOUND');
    const hidden = new Set(
      (
        await PlayerStats.find({ session: { $in: result.players.map((p) => p.session) }, nameHidden: true })
          .select('session')
          .lean()
      ).map((s) => s.session.toString())
    );
    const sid = req.guest._id.toString();
    res.json({
      roomCode: result.roomCode,
      quizTitle: result.quizTitle,
      quizSlug: result.quizSlug,
      mode: result.mode,
      questionCount: result.questionCount,
      playerCount: result.playerCount,
      finishedAt: result.finishedAt,
      players: result.players.slice(0, 100).map((p) => ({
        pid: p.pid,
        nickname: hidden.has(p.session.toString()) ? '•••' : p.nickname,
        avatar: p.avatar,
        color: p.color,
        score: p.score,
        correct: p.correct,
        rank: p.rank,
        teamKey: p.teamKey,
        isYou: p.session.toString() === sid
      })),
      teams: result.teams
    });
  })
);

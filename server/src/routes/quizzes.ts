import { Router, type Request } from 'express';
import { quizInputSchema, reportSchema, slugify, CATEGORY_SLUGS, DIFFICULTIES, LANGS, type QuizCardDTO, type QuizInput } from '@uzuz/shared';
import { Quiz, type QuizDoc } from '../models/Quiz';
import { Category } from '../models/Category';
import { GameResult } from '../models/GameResult';
import { PlayerStats } from '../models/PlayerStats';
import { Report } from '../models/misc';
import { asyncHandler, ApiError, clampInt, escapeRegex, notFound, parse, requireObjectId } from '../utils/http';
import { newToken, randomInt, safeEqual, sha256 } from '../utils/crypto';
import { actionLimiter } from '../middleware/rateLimit';
import { randomCode } from '@uzuz/shared';

export const quizzesRouter = Router();
export const categoriesRouter = Router();

type LeanQuiz = {
  _id: { toString(): string };
  slug: string;
  title: string;
  description: string;
  category: string;
  language: 'uz' | 'ru' | 'en';
  difficulty: string;
  questionCount: number;
  plays: number;
  authorName: string;
  isOfficial: boolean;
  cover?: string | null;
  createdAt: Date;
};

export function quizCard(q: LeanQuiz): QuizCardDTO {
  return {
    id: q._id.toString(),
    slug: q.slug,
    title: q.title,
    description: q.description,
    category: q.category,
    language: q.language,
    difficulty: q.difficulty,
    questionCount: q.questionCount,
    plays: q.plays,
    authorName: q.authorName,
    isOfficial: q.isOfficial,
    cover: q.cover ?? null,
    createdAt: new Date(q.createdAt).toISOString()
  };
}

const CARD_FIELDS = 'slug title description category language difficulty questionCount plays authorName isOfficial cover createdAt';

/* ---------- Categories ---------- */

categoriesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const [cats, counts] = await Promise.all([
      Category.find().sort({ order: 1 }).lean(),
      Quiz.aggregate<{ _id: string; n: number }>([
        { $match: { visibility: 'public', hidden: false } },
        { $group: { _id: '$category', n: { $sum: 1 } } }
      ])
    ]);
    const map = new Map(counts.map((c) => [c._id, c.n]));
    res.json({
      items: cats.map((c) => ({ slug: c.slug, name: c.name, icon: c.icon, color: c.color, quizCount: map.get(c.slug) ?? 0 }))
    });
  })
);

/* ---------- Edit permission ---------- */

function canEdit(req: Request, quiz: { ownerSession?: unknown; editKeyHash?: string | null }): boolean {
  if (quiz.ownerSession && String(quiz.ownerSession) === req.guest._id.toString()) return true;
  const key = req.header('x-edit-key');
  if (key && quiz.editKeyHash && key.length < 100) return safeEqual(sha256(key), quiz.editKeyHash);
  return false;
}

async function loadEditable(req: Request): Promise<QuizDoc> {
  const id = requireObjectId(req.params.id, 'QUIZ_NOT_FOUND');
  const quiz = await Quiz.findById(id);
  if (!quiz) throw notFound('QUIZ_NOT_FOUND');
  if (!canEdit(req, quiz)) throw new ApiError(403, 'EDIT_FORBIDDEN');
  return quiz;
}

function applyInput(quiz: QuizDoc, input: QuizInput): void {
  quiz.title = input.title;
  quiz.description = input.description;
  quiz.category = input.category;
  quiz.language = input.language;
  quiz.difficulty = input.difficulty;
  quiz.tags = input.tags;
  quiz.visibility = input.visibility;
  quiz.cover = input.cover ?? null;
  quiz.set(
    'questions',
    input.questions.map((q) => ({ ...q, image: q.image ?? null }))
  );
  quiz.questionCount = input.questions.length;
}

/* ---------- Public listing ---------- */

quizzesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter: Record<string, unknown> = { visibility: 'public', hidden: false };
    const q = String(req.query.q ?? '').trim().slice(0, 60);
    if (q) {
      const re = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ title: re }, { tags: re }, { description: re }];
    }
    const category = String(req.query.category ?? '');
    if ((CATEGORY_SLUGS as readonly string[]).includes(category)) filter.category = category;
    const language = String(req.query.language ?? '');
    if ((LANGS as readonly string[]).includes(language)) filter.language = language;
    const difficulty = String(req.query.difficulty ?? '');
    if ((DIFFICULTIES as readonly string[]).includes(difficulty)) filter.difficulty = difficulty;
    const size = String(req.query.size ?? '');
    if (size === 'short') filter.questionCount = { $lte: 10 };
    if (size === 'long') filter.questionCount = { $gt: 10 };
    if (req.query.featured === '1') filter.featured = true;
    // Favorites (stored in the browser) are fetched by id; unlisted quizzes are allowed here.
    if (typeof req.query.ids === 'string' && req.query.ids) {
      const ids = req.query.ids.split(',').filter((id) => /^[a-f0-9]{24}$/i.test(id)).slice(0, 100);
      filter._id = { $in: ids };
      delete filter.visibility;
    }

    const sort: Record<string, 1 | -1> =
      req.query.sort === 'new' ? { createdAt: -1 } : { featured: -1, plays: -1, createdAt: -1 };
    const limit = clampInt(req.query.limit, 1, 24, 12);
    const page = clampInt(req.query.page, 1, 500, 1);

    const [items, total] = await Promise.all([
      Quiz.find(filter).select(CARD_FIELDS).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
      Quiz.countDocuments(filter)
    ]);
    res.json({ items: items.map((i) => quizCard(i as unknown as LeanQuiz)), total, page, pages: Math.ceil(total / limit) });
  })
);

/** Quizzes this guest created (for "My quizzes"). */
quizzesRouter.get(
  '/mine',
  asyncHandler(async (req, res) => {
    const items = await Quiz.find({ ownerSession: req.guest._id }).select(CARD_FIELDS + ' visibility hidden').sort({ updatedAt: -1 }).limit(50).lean();
    res.json({ items: items.map((i) => ({ ...quizCard(i as unknown as LeanQuiz), visibility: i.visibility, hidden: i.hidden })) });
  })
);

quizzesRouter.get(
  '/by-slug/:slug',
  asyncHandler(async (req, res) => {
    const quiz = await Quiz.findOne({ slug: String(req.params.slug).slice(0, 80), hidden: false }).lean();
    if (!quiz) throw notFound('QUIZ_NOT_FOUND');

    const top = await GameResult.aggregate<{ _id: unknown; nickname: string; avatar: number; color: number; score: number; correct: number }>([
      { $match: { quiz: quiz._id, flagged: false } },
      { $unwind: '$players' },
      { $sort: { 'players.score': -1 } },
      {
        $group: {
          _id: '$players.session',
          nickname: { $first: '$players.nickname' },
          avatar: { $first: '$players.avatar' },
          color: { $first: '$players.color' },
          score: { $first: '$players.score' },
          correct: { $first: '$players.correct' }
        }
      },
      { $sort: { score: -1 } },
      { $limit: 30 }
    ]);
    const hidden = new Set(
      (await PlayerStats.find({ session: { $in: top.map((t) => t._id) }, $or: [{ hidden: true }, { nameHidden: true }] }).select('session').lean()).map((s) =>
        s.session.toString()
      )
    );

    const first = quiz.questions[0];
    res.json({
      ...quizCard(quiz as unknown as LeanQuiz),
      visibility: quiz.visibility,
      tags: quiz.tags,
      canEdit: canEdit(req, quiz),
      firstQuestion: first ? { text: first.text, type: first.type, options: first.options.map((o) => ({ text: o.text })) } : null,
      topScores: top
        .filter((t) => !hidden.has(String(t._id)))
        .slice(0, 10)
        .map((t, i) => ({ rank: i + 1, nickname: t.nickname, avatar: t.avatar, color: t.color, score: t.score, correct: t.correct }))
    });
  })
);

/** Full quiz including answers — only for the creator session or holder of the edit key. */
quizzesRouter.get(
  '/:id/edit',
  asyncHandler(async (req, res) => {
    const quiz = await loadEditable(req);
    res.json({
      id: quiz._id.toString(),
      slug: quiz.slug,
      title: quiz.title,
      description: quiz.description,
      category: quiz.category,
      language: quiz.language,
      difficulty: quiz.difficulty,
      tags: quiz.tags,
      visibility: quiz.visibility,
      cover: quiz.cover,
      questions: quiz.questions.map((q) => ({
        type: q.type,
        text: q.text,
        image: q.image ?? null,
        options: q.options.map((o) => ({ text: o.text, correct: o.correct })),
        timeLimit: q.timeLimit,
        points: q.points,
        explanation: q.explanation ?? ''
      }))
    });
  })
);

quizzesRouter.post(
  '/',
  actionLimiter(20, 60 * 60_000),
  asyncHandler(async (req, res) => {
    const input = parse(quizInputSchema, req.body);
    const editKey = newToken(18);
    const quiz = new Quiz({
      slug: `${slugify(input.title)}-${randomCode(6, randomInt, 'abcdefghjkmnpqrstuvwxyz23456789')}`,
      ownerSession: req.guest._id,
      editKeyHash: sha256(editKey),
      authorName: req.guest.nickname ?? 'Mehmon',
      isOfficial: false,
      questions: [],
      questionCount: 0,
      title: input.title,
      category: input.category,
      language: input.language,
      difficulty: input.difficulty
    });
    applyInput(quiz, input);
    await quiz.save();

    // quiz_creator badge
    await PlayerStats.updateOne(
      { session: req.guest._id },
      {
        $setOnInsert: { pid: req.guest.publicId, nickname: req.guest.nickname ?? 'Mehmon', avatar: req.guest.avatar, color: req.guest.color },
        $addToSet: { badges: 'quiz_creator' }
      },
      { upsert: true }
    );

    res.status(201).json({ id: quiz._id.toString(), slug: quiz.slug, editKey });
  })
);

quizzesRouter.put(
  '/:id',
  actionLimiter(60, 60 * 60_000),
  asyncHandler(async (req, res) => {
    const quiz = await loadEditable(req);
    const input = parse(quizInputSchema, req.body);
    applyInput(quiz, input);
    await quiz.save();
    res.json({ id: quiz._id.toString(), slug: quiz.slug });
  })
);

quizzesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const quiz = await loadEditable(req);
    await quiz.deleteOne();
    res.json({ ok: true });
  })
);

quizzesRouter.post(
  '/:id/report',
  actionLimiter(20, 60 * 60_000),
  asyncHandler(async (req, res) => {
    const id = requireObjectId(req.params.id, 'QUIZ_NOT_FOUND');
    const body = parse(reportSchema.omit({ targetType: true, targetId: true }), req.body);
    const quiz = await Quiz.findById(id).select('title');
    if (!quiz) throw notFound('QUIZ_NOT_FOUND');
    const created = await Report.updateOne(
      { targetType: 'quiz', targetId: id, reporter: req.guest._id },
      { $setOnInsert: { targetLabel: quiz.title, reason: body.reason, details: body.details, status: 'open' } },
      { upsert: true }
    );
    if (created.upsertedCount) await Quiz.updateOne({ _id: id }, { $inc: { reportsCount: 1 } });
    res.status(201).json({ ok: true });
  })
);

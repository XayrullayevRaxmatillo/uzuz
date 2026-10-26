import { Router, type Request } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { CATEGORY_SLUGS } from '@uzuz/shared';
import { AdminSession, AdminUser, AuditLog, Report } from '../models/misc';
import { Quiz } from '../models/Quiz';
import { Team } from '../models/Team';
import { Category } from '../models/Category';
import { GameResult } from '../models/GameResult';
import { GuestSession } from '../models/GuestSession';
import { PlayerStats } from '../models/PlayerStats';
import { ADMIN_COOKIE, ADMIN_SESSION_MS, adminCookieOptions, requireAdmin } from '../middleware/admin';
import { ipLimiter } from '../middleware/rateLimit';
import { asyncHandler, ApiError, clampInt, escapeRegex, notFound, parse, requireObjectId } from '../utils/http';
import { newToken, sha256 } from '../utils/crypto';
import { games } from '../game/manager';
import { quizCard } from './quizzes';

export const adminRouter = Router();

const DUMMY_HASH = bcrypt.hashSync('uzuz-timing-equalizer', 10);

async function audit(req: Request, action: string, targetType: string, targetId: string, details: Record<string, unknown> = {}) {
  await AuditLog.create({ admin: req.admin!.id, adminName: req.admin!.username, action, targetType, targetId, details });
}

/* ---------- Auth ---------- */

adminRouter.post(
  '/login',
  ipLimiter(5, 15 * 60_000),
  asyncHandler(async (req, res) => {
    const { username, password } = parse(z.object({ username: z.string().min(1).max(50), password: z.string().min(1).max(200) }).strict(), req.body);
    const admin = await AdminUser.findOne({ username: username.toLowerCase().trim() });
    // Always run bcrypt to keep timing uniform, even for unknown usernames.
    const okPw = await bcrypt.compare(password, admin?.passwordHash ?? DUMMY_HASH);
    if (!admin || !okPw) throw new ApiError(401, 'ADMIN_AUTH');
    const token = newToken();
    await AdminSession.create({ tokenHash: sha256(token), admin: admin._id, expiresAt: new Date(Date.now() + ADMIN_SESSION_MS) });
    admin.lastLoginAt = new Date();
    await admin.save();
    res.cookie(ADMIN_COOKIE, token, adminCookieOptions());
    res.json({ username: admin.username });
  })
);

adminRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[ADMIN_COOKIE] as string | undefined;
    if (token) await AdminSession.deleteOne({ tokenHash: sha256(token) });
    res.clearCookie(ADMIN_COOKIE, { ...adminCookieOptions(), maxAge: undefined });
    res.json({ ok: true });
  })
);

adminRouter.use(requireAdmin);

adminRouter.get('/me', (req, res) => {
  res.json({ username: req.admin!.username });
});

/* ---------- Dashboard ---------- */

adminRouter.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const [quizzes, hiddenQuizzes, teams, sessions, gamesToday, gamesTotal, openReports] = await Promise.all([
      Quiz.countDocuments(),
      Quiz.countDocuments({ hidden: true }),
      Team.countDocuments({ status: 'active' }),
      GuestSession.countDocuments(),
      GameResult.countDocuments({ finishedAt: { $gte: startOfDay } }),
      GameResult.countDocuments(),
      Report.countDocuments({ status: 'open' })
    ]);
    res.json({ quizzes, hiddenQuizzes, teams, sessions, gamesToday, gamesTotal, openReports, live: games.stats() });
  })
);

/* ---------- Quizzes ---------- */

adminRouter.get(
  '/quizzes',
  asyncHandler(async (req, res) => {
    const filter: Record<string, unknown> = {};
    const q = String(req.query.q ?? '').trim().slice(0, 60);
    if (q) filter.title = new RegExp(escapeRegex(q), 'i');
    if (req.query.status === 'hidden') filter.hidden = true;
    if (req.query.status === 'reported') filter.reportsCount = { $gt: 0 };
    const page = clampInt(req.query.page, 1, 1000, 1);
    const [items, total] = await Promise.all([
      Quiz.find(filter).select('-questions').sort({ createdAt: -1 }).skip((page - 1) * 30).limit(30).lean(),
      Quiz.countDocuments(filter)
    ]);
    res.json({
      items: items.map((i) => ({ ...quizCard(i as never), hidden: i.hidden, featured: i.featured, reportsCount: i.reportsCount, visibility: i.visibility })),
      total,
      page,
      pages: Math.ceil(total / 30)
    });
  })
);

adminRouter.patch(
  '/quizzes/:id',
  asyncHandler(async (req, res) => {
    const id = requireObjectId(req.params.id, 'QUIZ_NOT_FOUND');
    const body = parse(z.object({ hidden: z.boolean().optional(), featured: z.boolean().optional() }).strict(), req.body);
    const quiz = await Quiz.findByIdAndUpdate(id, { $set: body }, { new: true });
    if (!quiz) throw notFound('QUIZ_NOT_FOUND');
    await audit(req, 'quiz.update', 'quiz', id, body);
    res.json({ ok: true });
  })
);

adminRouter.delete(
  '/quizzes/:id',
  asyncHandler(async (req, res) => {
    const id = requireObjectId(req.params.id, 'QUIZ_NOT_FOUND');
    const quiz = await Quiz.findByIdAndDelete(id);
    if (!quiz) throw notFound('QUIZ_NOT_FOUND');
    await audit(req, 'quiz.delete', 'quiz', id, { title: quiz.title });
    res.json({ ok: true });
  })
);

/* ---------- Reports ---------- */

adminRouter.get(
  '/reports',
  asyncHandler(async (req, res) => {
    const status = ['open', 'resolved', 'dismissed'].includes(String(req.query.status)) ? String(req.query.status) : 'open';
    const items = await Report.find({ status }).sort({ createdAt: -1 }).limit(100).lean();
    res.json({
      items: items.map((r) => ({
        id: r._id.toString(),
        targetType: r.targetType,
        targetId: r.targetId,
        targetLabel: r.targetLabel,
        reason: r.reason,
        details: r.details,
        status: r.status,
        createdAt: (r as unknown as { createdAt: Date }).createdAt
      }))
    });
  })
);

adminRouter.patch(
  '/reports/:id',
  asyncHandler(async (req, res) => {
    const id = requireObjectId(req.params.id);
    const body = parse(z.object({ status: z.enum(['open', 'resolved', 'dismissed']), hideTarget: z.boolean().optional() }).strict(), req.body);
    const report = await Report.findById(id);
    if (!report) throw notFound();
    report.status = body.status;
    await report.save();
    if (body.hideTarget) {
      if (report.targetType === 'quiz') await Quiz.updateOne({ _id: report.targetId }, { $set: { hidden: true } });
      if (report.targetType === 'team') await Team.updateOne({ _id: report.targetId }, { $set: { hiddenByAdmin: true } });
      if (report.targetType === 'player') await PlayerStats.updateOne({ pid: report.targetId }, { $set: { nameHidden: true } });
    }
    await audit(req, 'report.update', 'report', id, body);
    res.json({ ok: true });
  })
);

/* ---------- Categories ---------- */

const categoryBody = z
  .object({
    name: z.object({ uz: z.string().min(1).max(40), ru: z.string().min(1).max(40), en: z.string().min(1).max(40) }).strict(),
    icon: z.string().min(1).max(8),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    order: z.number().int().min(0).max(100)
  })
  .strict();

adminRouter.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    res.json({ items: await Category.find().sort({ order: 1 }).lean() });
  })
);

adminRouter.put(
  '/categories/:slug',
  asyncHandler(async (req, res) => {
    const slug = String(req.params.slug);
    if (!(CATEGORY_SLUGS as readonly string[]).includes(slug)) throw notFound();
    const body = parse(categoryBody, req.body);
    await Category.updateOne({ slug }, { $set: body }, { upsert: true });
    await audit(req, 'category.update', 'category', slug, body);
    res.json({ ok: true });
  })
);

/* ---------- Teams ---------- */

adminRouter.get(
  '/teams',
  asyncHandler(async (req, res) => {
    const filter: Record<string, unknown> = { status: 'active' };
    const q = String(req.query.q ?? '').trim().slice(0, 40);
    if (q) filter.name = new RegExp(escapeRegex(q), 'i');
    const items = await Team.find(filter).select('name emoji visibility memberCount capacity hiddenByAdmin createdAt totalScore').sort({ createdAt: -1 }).limit(100).lean();
    res.json({ items: items.map((t) => ({ ...t, id: t._id.toString() })) });
  })
);

adminRouter.patch(
  '/teams/:id',
  asyncHandler(async (req, res) => {
    const id = requireObjectId(req.params.id, 'TEAM_NOT_FOUND');
    const body = parse(z.object({ hiddenByAdmin: z.boolean().optional(), archived: z.boolean().optional() }).strict(), req.body);
    const set: Record<string, unknown> = {};
    if (body.hiddenByAdmin !== undefined) set.hiddenByAdmin = body.hiddenByAdmin;
    if (body.archived) set.status = 'archived';
    const r = await Team.updateOne({ _id: id }, { $set: set });
    if (!r.matchedCount) throw notFound('TEAM_NOT_FOUND');
    await audit(req, 'team.update', 'team', id, body);
    res.json({ ok: true });
  })
);

/* ---------- Audit ---------- */

adminRouter.get(
  '/audit',
  asyncHandler(async (_req, res) => {
    const items = await AuditLog.find().sort({ createdAt: -1 }).limit(200).lean();
    res.json({ items });
  })
);

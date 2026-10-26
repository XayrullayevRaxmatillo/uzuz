import { Router, type Request } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import {
  CATEGORY_SLUGS,
  LANGS,
  MAX_TEAMS_PER_SESSION,
  SKILL_LEVELS,
  generateTeamCode,
  normalizeTeamCode,
  rankTeams,
  teamInputSchema,
  teamUpdateSchema,
  type TeamCardDTO
} from '@uzuz/shared';
import { Team, TeamJoinRequest, type TeamDoc } from '../models/Team';
import { asyncHandler, ApiError, clampInt, conflict, escapeRegex, forbidden, notFound, parse, requireObjectId } from '../utils/http';
import { randomInt } from '../utils/crypto';
import { actionLimiter, ipLimiter } from '../middleware/rateLimit';
import { presence } from '../services/presence';
import { notifySession } from '../sockets';

export const teamsRouter = Router();

type LeanTeam = {
  _id: mongoose.Types.ObjectId;
  name: string;
  description: string;
  emoji: string;
  subject: string;
  language: 'uz' | 'ru' | 'en';
  level: string;
  capacity: number;
  memberCount: number;
  visibility: 'public' | 'private';
  joinPolicy: 'open' | 'approval' | 'invite';
  totalScore: number;
  gamesPlayed: number;
  lastActiveAt: Date;
  owner: mongoose.Types.ObjectId;
  inviteCode: string;
  members: { session: mongoose.Types.ObjectId; pid: string; nickname: string; avatar: number; color: number; joinedAt: Date }[];
};

function card(t: LeanTeam): TeamCardDTO {
  return {
    id: t._id.toString(),
    name: t.name,
    description: t.description,
    emoji: t.emoji,
    subject: t.subject,
    language: t.language,
    level: t.level,
    capacity: t.capacity,
    memberCount: t.memberCount,
    visibility: t.visibility,
    joinPolicy: t.joinPolicy,
    totalScore: t.totalScore,
    gamesPlayed: t.gamesPlayed,
    lastActiveAt: new Date(t.lastActiveAt).toISOString(),
    members: t.members.slice(0, 6).map((m) => ({ pid: m.pid, nickname: m.nickname, avatar: m.avatar, color: m.color }))
  };
}

const PUBLIC_LIST = { status: 'active', visibility: 'public', hiddenByAdmin: false };

function memberEntry(req: Request) {
  const g = req.guest;
  return { session: g._id, pid: g.publicId, nickname: g.nickname ?? `Mehmon_${g.publicId.slice(0, 4)}`, avatar: g.avatar, color: g.color, joinedAt: new Date() };
}

async function assertTeamLimit(sessionId: mongoose.Types.ObjectId): Promise<void> {
  const n = await Team.countDocuments({ status: 'active', 'members.session': sessionId });
  if (n >= MAX_TEAMS_PER_SESSION) throw conflict('TEAM_LIMIT');
}

/** Atomic join: capacity, duplicate membership and status checked in one update. */
async function atomicJoin(teamId: string, member: ReturnType<typeof memberEntry>): Promise<TeamDoc> {
  const updated = await Team.findOneAndUpdate(
    {
      _id: teamId,
      status: 'active',
      'members.session': { $ne: member.session },
      $expr: { $lt: ['$memberCount', '$capacity'] }
    },
    { $push: { members: member }, $inc: { memberCount: 1 }, $set: { lastActiveAt: new Date() } },
    { new: true }
  );
  if (updated) return updated;
  const team = await Team.findById(teamId).lean();
  if (!team || team.status !== 'active') throw notFound('TEAM_NOT_FOUND');
  if (team.members.some((m) => m.session.equals(member.session))) throw conflict('TEAM_ALREADY_MEMBER');
  throw conflict('TEAM_FULL');
}

async function loadTeam(id: unknown): Promise<TeamDoc> {
  const teamId = requireObjectId(id, 'TEAM_NOT_FOUND');
  const team = await Team.findOne({ _id: teamId, status: 'active' });
  if (!team) throw notFound('TEAM_NOT_FOUND');
  return team;
}

function assertOwner(req: Request, team: TeamDoc): void {
  if (!team.owner.equals(req.guest._id)) throw forbidden('TEAM_NOT_OWNER');
}

function teamDetail(req: Request, team: LeanTeam, extra: { pendingRequest: boolean; requestCount: number }) {
  const sid = req.guest._id;
  const isOwner = team.owner.equals(sid);
  const isMember = team.members.some((m) => m.session.equals(sid));
  return {
    ...card(team),
    members: [...team.members]
      .sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime())
      .map((m) => ({
        pid: m.pid,
        nickname: m.nickname,
        avatar: m.avatar,
        color: m.color,
        isOwner: team.owner.equals(m.session),
        online: presence.isOnline(m.session.toString()),
        joinedAt: new Date(m.joinedAt).toISOString()
      })),
    you: { isMember, isOwner, pendingRequest: extra.pendingRequest },
    // Invite code is visible to members (to share with friends); only the owner can regenerate it.
    inviteCode: isMember ? team.inviteCode : null,
    requestCount: isOwner ? extra.requestCount : 0
  };
}

/* ---------- Listing & discovery ---------- */

teamsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter: Record<string, unknown> = { ...PUBLIC_LIST };
    const q = String(req.query.q ?? '').trim().slice(0, 40);
    if (q) filter.name = new RegExp(escapeRegex(q), 'i');
    const subject = String(req.query.subject ?? '');
    if ((CATEGORY_SLUGS as readonly string[]).includes(subject)) filter.subject = subject;
    const language = String(req.query.language ?? '');
    if ((LANGS as readonly string[]).includes(language)) filter.language = language;
    const level = String(req.query.level ?? '');
    if ((SKILL_LEVELS as readonly string[]).includes(level)) filter.level = level;
    if (req.query.hasSpace === '1') filter.$expr = { $lt: ['$memberCount', '$capacity'] };

    const sort: Record<string, 1 | -1> = req.query.sort === 'new' ? { createdAt: -1 } : { lastActiveAt: -1 };
    const limit = clampInt(req.query.limit, 1, 30, 12);
    const page = clampInt(req.query.page, 1, 500, 1);
    const [items, total] = await Promise.all([
      Team.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
      Team.countDocuments(filter)
    ]);
    res.json({ items: (items as unknown as LeanTeam[]).map(card), total, page, pages: Math.ceil(total / limit) });
  })
);

teamsRouter.get(
  '/mine',
  asyncHandler(async (req, res) => {
    const items = await Team.find({ status: 'active', 'members.session': req.guest._id }).sort({ lastActiveAt: -1 }).lean();
    res.json({
      items: (items as unknown as LeanTeam[]).map((t) => ({ ...card(t), isOwner: t.owner.equals(req.guest._id) }))
    });
  })
);

const matchQuery = z.object({
  subject: z.enum(CATEGORY_SLUGS).optional(),
  language: z.enum(LANGS).optional(),
  level: z.enum(SKILL_LEVELS).optional()
});

teamsRouter.get(
  '/match',
  asyncHandler(async (req, res) => {
    const prefs = parse(matchQuery, {
      subject: req.query.subject || undefined,
      language: req.query.language || undefined,
      level: req.query.level || undefined
    });
    const candidates = (await Team.find({
      ...PUBLIC_LIST,
      joinPolicy: { $ne: 'invite' },
      'members.session': { $ne: req.guest._id },
      $expr: { $lt: ['$memberCount', '$capacity'] }
    })
      .sort({ lastActiveAt: -1 })
      .limit(300)
      .lean()) as unknown as LeanTeam[];
    const ranked = rankTeams(prefs, candidates, 5);
    res.json({ items: ranked.map((r) => ({ team: card(r.team), score: r.score, reasons: r.reasons })) });
  })
);

/* ---------- Create ---------- */

teamsRouter.post(
  '/',
  actionLimiter(10, 60 * 60_000),
  asyncHandler(async (req, res) => {
    const input = parse(teamInputSchema, req.body);
    await assertTeamLimit(req.guest._id);
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const team = await Team.create({
          ...input,
          owner: req.guest._id,
          members: [memberEntry(req)],
          memberCount: 1,
          inviteCode: generateTeamCode(randomInt)
        });
        res.status(201).json({ id: team._id.toString(), inviteCode: team.inviteCode });
        return;
      } catch (err) {
        if ((err as { code?: number }).code !== 11000) throw err;
      }
    }
    throw new ApiError(500, 'INTERNAL');
  })
);

/* ---------- Join by invite code ---------- */

teamsRouter.post(
  '/join-by-code',
  ipLimiter(20, 60_000),
  asyncHandler(async (req, res) => {
    const { code } = parse(z.object({ code: z.string().min(6).max(12) }).strict(), req.body);
    const team = await Team.findOne({ inviteCode: normalizeTeamCode(code), status: 'active' }).select('_id');
    if (!team) throw notFound('TEAM_INVALID_CODE');
    await assertTeamLimit(req.guest._id);
    const joined = await atomicJoin(team._id.toString(), memberEntry(req));
    res.json({ id: joined._id.toString(), status: 'joined' });
  })
);

/* ---------- Detail ---------- */

teamsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const teamId = requireObjectId(req.params.id, 'TEAM_NOT_FOUND');
    const team = (await Team.findOne({ _id: teamId, status: 'active' }).lean()) as unknown as (LeanTeam & { hiddenByAdmin: boolean }) | null;
    if (!team) throw notFound('TEAM_NOT_FOUND');
    const sid = req.guest._id;
    const isMember = team.members.some((m) => m.session.equals(sid));
    const code = typeof req.query.code === 'string' ? normalizeTeamCode(req.query.code) : null;
    // Private teams are visible only to members or to someone holding the invite code.
    if ((team.visibility === 'private' || team.hiddenByAdmin) && !isMember && code !== team.inviteCode) throw notFound('TEAM_NOT_FOUND');
    const [pending, requestCount] = await Promise.all([
      TeamJoinRequest.exists({ team: team._id, session: sid, status: 'pending' }),
      team.owner.equals(sid) ? TeamJoinRequest.countDocuments({ team: team._id, status: 'pending' }) : Promise.resolve(0)
    ]);
    res.json(teamDetail(req, team, { pendingRequest: !!pending, requestCount }));
  })
);

/* ---------- Join / leave ---------- */

teamsRouter.post(
  '/:id/join',
  actionLimiter(30, 60 * 60_000),
  asyncHandler(async (req, res) => {
    const { code } = parse(z.object({ code: z.string().max(12).optional() }).strict(), req.body ?? {});
    const team = await loadTeam(req.params.id);
    const sid = req.guest._id;
    if (team.members.some((m) => m.session.equals(sid))) throw conflict('TEAM_ALREADY_MEMBER');
    if (team.memberCount >= team.capacity) throw conflict('TEAM_FULL');
    await assertTeamLimit(sid);

    const hasCode = !!code && normalizeTeamCode(code) === team.inviteCode;
    if (hasCode || (team.visibility === 'public' && team.joinPolicy === 'open')) {
      await atomicJoin(team._id.toString(), memberEntry(req));
      res.json({ status: 'joined' });
      return;
    }
    if (team.joinPolicy === 'approval') {
      const existing = await TeamJoinRequest.findOne({ team: team._id, session: sid, status: 'pending' });
      if (existing) throw conflict('TEAM_REQUEST_PENDING');
      const m = memberEntry(req);
      await TeamJoinRequest.create({ team: team._id, session: sid, pid: m.pid, nickname: m.nickname, avatar: m.avatar, color: m.color });
      notifySession(team.owner.toString(), 'team:request', { teamId: team._id.toString(), teamName: team.name, nickname: m.nickname });
      res.json({ status: 'requested' });
      return;
    }
    throw forbidden('TEAM_INVITE_REQUIRED');
  })
);

teamsRouter.post(
  '/:id/leave',
  asyncHandler(async (req, res) => {
    const team = await loadTeam(req.params.id);
    const sid = req.guest._id;
    const updated = await Team.findOneAndUpdate(
      { _id: team._id, 'members.session': sid },
      { $pull: { members: { session: sid } }, $inc: { memberCount: -1 } },
      { new: true }
    );
    if (!updated) throw conflict('TEAM_NOT_MEMBER');
    if (updated.members.length === 0) {
      updated.status = 'archived';
      await updated.save();
    } else if (updated.owner.equals(sid)) {
      // Ownership passes to the longest-standing member.
      const oldest = [...updated.members].sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime())[0];
      updated.owner = oldest.session;
      await updated.save();
    }
    res.json({ ok: true });
  })
);

/* ---------- Owner actions ---------- */

teamsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const team = await loadTeam(req.params.id);
    assertOwner(req, team);
    const body = parse(teamUpdateSchema, req.body);
    if (body.capacity !== undefined && body.capacity < team.memberCount) throw conflict('TEAM_CAPACITY_TOO_LOW');
    Object.assign(team, body);
    await team.save();
    res.json({ ok: true });
  })
);

teamsRouter.post(
  '/:id/kick',
  asyncHandler(async (req, res) => {
    const { pid } = parse(z.object({ pid: z.string().min(1).max(32) }).strict(), req.body);
    const team = await loadTeam(req.params.id);
    assertOwner(req, team);
    const target = team.members.find((m) => m.pid === pid);
    if (!target) throw notFound('TEAM_NOT_MEMBER');
    if (target.session.equals(team.owner)) throw forbidden('FORBIDDEN');
    await Team.updateOne({ _id: team._id, 'members.session': target.session }, { $pull: { members: { session: target.session } }, $inc: { memberCount: -1 } });
    res.json({ ok: true });
  })
);

teamsRouter.post(
  '/:id/transfer',
  asyncHandler(async (req, res) => {
    const { pid } = parse(z.object({ pid: z.string().min(1).max(32) }).strict(), req.body);
    const team = await loadTeam(req.params.id);
    assertOwner(req, team);
    const target = team.members.find((m) => m.pid === pid);
    if (!target) throw notFound('TEAM_NOT_MEMBER');
    // Conditional update prevents races with concurrent ownership changes.
    const r = await Team.updateOne({ _id: team._id, owner: req.guest._id, 'members.session': target.session }, { $set: { owner: target.session } });
    if (!r.modifiedCount) throw forbidden('TEAM_NOT_OWNER');
    res.json({ ok: true });
  })
);

teamsRouter.post(
  '/:id/invite-code',
  actionLimiter(20, 60 * 60_000),
  asyncHandler(async (req, res) => {
    const team = await loadTeam(req.params.id);
    assertOwner(req, team);
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        team.inviteCode = generateTeamCode(randomInt);
        await team.save();
        res.json({ inviteCode: team.inviteCode });
        return;
      } catch (err) {
        if ((err as { code?: number }).code !== 11000) throw err;
      }
    }
    throw new ApiError(500, 'INTERNAL');
  })
);

teamsRouter.get(
  '/:id/requests',
  asyncHandler(async (req, res) => {
    const team = await loadTeam(req.params.id);
    assertOwner(req, team);
    const items = await TeamJoinRequest.find({ team: team._id, status: 'pending' }).sort({ createdAt: 1 }).limit(100).lean();
    res.json({
      items: items.map((r) => ({ id: r._id.toString(), pid: r.pid, nickname: r.nickname, avatar: r.avatar, color: r.color, createdAt: (r as unknown as { createdAt: Date }).createdAt }))
    });
  })
);

teamsRouter.post(
  '/:id/requests/:rid',
  asyncHandler(async (req, res) => {
    const { action } = parse(z.object({ action: z.enum(['accept', 'reject']) }).strict(), req.body);
    const team = await loadTeam(req.params.id);
    assertOwner(req, team);
    const rid = requireObjectId(req.params.rid);
    const request = await TeamJoinRequest.findOne({ _id: rid, team: team._id, status: 'pending' });
    if (!request) throw notFound();

    if (action === 'accept') {
      const n = await Team.countDocuments({ status: 'active', 'members.session': request.session });
      if (n >= MAX_TEAMS_PER_SESSION) throw conflict('TEAM_LIMIT');
      await atomicJoin(team._id.toString(), {
        session: request.session,
        pid: request.pid,
        nickname: request.nickname,
        avatar: request.avatar,
        color: request.color,
        joinedAt: new Date()
      });
    }
    request.status = action === 'accept' ? 'accepted' : 'rejected';
    await request.save();
    notifySession(request.session.toString(), 'team:requestResult', { teamId: team._id.toString(), teamName: team.name, accepted: action === 'accept' });
    res.json({ ok: true });
  })
);

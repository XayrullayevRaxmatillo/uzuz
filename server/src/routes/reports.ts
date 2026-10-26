import { Router } from 'express';
import mongoose from 'mongoose';
import { reportSchema } from '@uzuz/shared';
import { Report } from '../models/misc';
import { Quiz } from '../models/Quiz';
import { Team } from '../models/Team';
import { asyncHandler, notFound, parse } from '../utils/http';
import { actionLimiter } from '../middleware/rateLimit';

export const reportsRouter = Router();

reportsRouter.post(
  '/',
  actionLimiter(20, 60 * 60_000),
  asyncHandler(async (req, res) => {
    const body = parse(reportSchema, req.body);
    let label = '';
    if (body.targetType === 'quiz') {
      if (!mongoose.isValidObjectId(body.targetId)) throw notFound('QUIZ_NOT_FOUND');
      const q = await Quiz.findById(body.targetId).select('title');
      if (!q) throw notFound('QUIZ_NOT_FOUND');
      label = q.title;
    } else if (body.targetType === 'team') {
      if (!mongoose.isValidObjectId(body.targetId)) throw notFound('TEAM_NOT_FOUND');
      const t = await Team.findById(body.targetId).select('name');
      if (!t) throw notFound('TEAM_NOT_FOUND');
      label = t.name;
    } else {
      label = body.targetId; // player public id
    }
    const r = await Report.updateOne(
      { targetType: body.targetType, targetId: body.targetId, reporter: req.guest._id },
      { $setOnInsert: { targetLabel: label, reason: body.reason, details: body.details, status: 'open' } },
      { upsert: true }
    );
    if (r.upsertedCount && body.targetType === 'quiz') await Quiz.updateOne({ _id: body.targetId }, { $inc: { reportsCount: 1 } });
    res.status(201).json({ ok: true });
  })
);

import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { CATEGORY_SLUGS, LANGS, SKILL_LEVELS, TEAM_JOIN_POLICIES, TEAM_VISIBILITY } from '@uzuz/shared';

const memberSchema = new Schema(
  {
    session: { type: Schema.Types.ObjectId, ref: 'GuestSession', required: true },
    pid: { type: String, required: true },
    nickname: { type: String, required: true },
    avatar: { type: Number, default: 0 },
    color: { type: Number, default: 0 },
    joinedAt: { type: Date, default: () => new Date() }
  },
  { _id: false }
);

const teamSchema = new Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: '' },
    emoji: { type: String, default: '⚡' },
    subject: { type: String, enum: CATEGORY_SLUGS, required: true },
    language: { type: String, enum: LANGS, required: true },
    level: { type: String, enum: SKILL_LEVELS, required: true },
    capacity: { type: Number, required: true },
    visibility: { type: String, enum: TEAM_VISIBILITY, required: true },
    joinPolicy: { type: String, enum: TEAM_JOIN_POLICIES, required: true },
    owner: { type: Schema.Types.ObjectId, ref: 'GuestSession', required: true },
    members: { type: [memberSchema], default: [] },
    memberCount: { type: Number, default: 0 },
    inviteCode: { type: String, required: true, unique: true },
    status: { type: String, enum: ['active', 'archived'], default: 'active', index: true },
    hiddenByAdmin: { type: Boolean, default: false },
    totalScore: { type: Number, default: 0 },
    gamesPlayed: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    lastActiveAt: { type: Date, default: () => new Date() }
  },
  { timestamps: true }
);

teamSchema.index({ 'members.session': 1 });
teamSchema.index({ status: 1, visibility: 1, lastActiveAt: -1 });
teamSchema.index({ status: 1, totalScore: -1 });

export type TeamAttrs = InferSchemaType<typeof teamSchema>;
export type TeamDoc = HydratedDocument<TeamAttrs>;
export const Team = model('Team', teamSchema);

const joinRequestSchema = new Schema(
  {
    team: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
    session: { type: Schema.Types.ObjectId, ref: 'GuestSession', required: true },
    pid: { type: String, required: true },
    nickname: { type: String, required: true },
    avatar: { type: Number, default: 0 },
    color: { type: Number, default: 0 },
    status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' }
  },
  { timestamps: true }
);

joinRequestSchema.index({ team: 1, session: 1 }, { unique: true, partialFilterExpression: { status: 'pending' } });
joinRequestSchema.index({ team: 1, status: 1, createdAt: 1 });

export const TeamJoinRequest = model('TeamJoinRequest', joinRequestSchema);

import { Schema, model, type InferSchemaType } from 'mongoose';
import { ROOM_MODES } from '@uzuz/shared';

/** One participant's validated result (spec: Participant). */
const participantSchema = new Schema(
  {
    session: { type: Schema.Types.ObjectId, ref: 'GuestSession', required: true },
    pid: { type: String, required: true },
    nickname: { type: String, required: true },
    avatar: { type: Number, default: 0 },
    color: { type: Number, default: 0 },
    score: { type: Number, required: true },
    correct: { type: Number, required: true },
    answered: { type: Number, required: true },
    bestStreak: { type: Number, default: 0 },
    rank: { type: Number, required: true },
    xp: { type: Number, default: 0 },
    teamKey: { type: String, default: null },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', default: null }
  },
  { _id: false }
);

const teamResultSchema = new Schema(
  {
    key: { type: String, required: true },
    name: { type: String, default: '' },
    color: { type: String, default: null },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', default: null },
    score: { type: Number, required: true },
    members: { type: Number, required: true },
    rank: { type: Number, required: true }
  },
  { _id: false }
);

const gameResultSchema = new Schema(
  {
    roomCode: { type: String, required: true, index: true },
    quiz: { type: Schema.Types.ObjectId, ref: 'Quiz', required: true, index: true },
    quizTitle: { type: String, required: true },
    quizSlug: { type: String, default: null },
    mode: { type: String, enum: ROOM_MODES, required: true },
    questionCount: { type: Number, required: true },
    playerCount: { type: Number, required: true },
    eligible: { type: Boolean, required: true },
    flagged: { type: Boolean, default: false },
    startedAt: { type: Date, required: true },
    finishedAt: { type: Date, required: true, index: true },
    players: { type: [participantSchema], default: [] },
    teams: { type: [teamResultSchema], default: [] }
  },
  { timestamps: true }
);

gameResultSchema.index({ 'players.session': 1, finishedAt: -1 });

export type GameResultAttrs = InferSchemaType<typeof gameResultSchema>;
export const GameResult = model('GameResult', gameResultSchema);

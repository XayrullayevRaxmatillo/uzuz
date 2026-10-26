import { Schema, model, type InferSchemaType } from 'mongoose';

const playerStatsSchema = new Schema(
  {
    session: { type: Schema.Types.ObjectId, ref: 'GuestSession', required: true, unique: true },
    pid: { type: String, required: true },
    nickname: { type: String, default: 'Mehmon' },
    avatar: { type: Number, default: 0 },
    color: { type: Number, default: 0 },
    hidden: { type: Boolean, default: false },
    /** Admin moderation: name hidden from public boards */
    nameHidden: { type: Boolean, default: false },
    xp: { type: Number, default: 0 },
    games: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    correct: { type: Number, default: 0 },
    answered: { type: Number, default: 0 },
    bestStreak: { type: Number, default: 0 },
    badges: { type: [String], default: [] },
    dailyXp: { type: Number, default: 0 },
    dailyXpDate: { type: String, default: '' },
    lastPlayedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

playerStatsSchema.index({ hidden: 1, xp: -1 });

export type PlayerStatsAttrs = InferSchemaType<typeof playerStatsSchema>;
export const PlayerStats = model('PlayerStats', playerStatsSchema);

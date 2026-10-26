import { Schema, model, type InferSchemaType } from 'mongoose';
import { PHASES, ROOM_MODES } from '@uzuz/shared';

const roomSchema = new Schema(
  {
    code: { type: String, required: true },
    quiz: { type: Schema.Types.ObjectId, ref: 'Quiz', required: true },
    quizTitle: { type: String, required: true },
    mode: { type: String, enum: ROOM_MODES, required: true },
    settings: { type: Schema.Types.Mixed, default: {} },
    hostSession: { type: Schema.Types.ObjectId, ref: 'GuestSession', required: true },
    /** true while a live in-memory game exists for this code */
    active: { type: Boolean, default: true },
    phase: { type: String, enum: PHASES, default: 'LOBBY' },
    playerCount: { type: Number, default: 0 },
    finishedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true }
  },
  { timestamps: true }
);

// A code is unique among active rooms only.
roomSchema.index({ code: 1 }, { unique: true, partialFilterExpression: { active: true } });
roomSchema.index({ code: 1, createdAt: -1 });
roomSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type RoomAttrs = InferSchemaType<typeof roomSchema>;
export const Room = model('Room', roomSchema);

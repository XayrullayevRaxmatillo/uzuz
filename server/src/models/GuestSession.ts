import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const guestSessionSchema = new Schema(
  {
    tokenHash: { type: String, required: true, unique: true },
    /** Public, non-secret identifier shown to other players. */
    publicId: { type: String, required: true, unique: true },
    nickname: { type: String, default: null },
    avatar: { type: Number, default: 0 },
    color: { type: Number, default: 0 },
    hideFromLeaderboard: { type: Boolean, default: false },
    restoreCodeHash: { type: String, default: null, index: { sparse: true } },
    lastSeenAt: { type: Date, default: () => new Date() },
    expiresAt: { type: Date, required: true }
  },
  { timestamps: true }
);

// MongoDB deletes the document once expiresAt passes (sliding 30-day expiry).
guestSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type GuestSessionAttrs = InferSchemaType<typeof guestSessionSchema>;
export type GuestSessionDoc = HydratedDocument<GuestSessionAttrs>;
export const GuestSession = model('GuestSession', guestSessionSchema);

import { Schema, model } from 'mongoose';
import { REPORT_REASONS } from '@uzuz/shared';

/* ---------- Report (moderation queue) ---------- */
const reportSchema = new Schema(
  {
    targetType: { type: String, enum: ['quiz', 'team', 'player'], required: true },
    targetId: { type: String, required: true },
    targetLabel: { type: String, default: '' },
    reason: { type: String, enum: REPORT_REASONS, required: true },
    details: { type: String, default: '' },
    reporter: { type: Schema.Types.ObjectId, ref: 'GuestSession', required: true },
    status: { type: String, enum: ['open', 'resolved', 'dismissed'], default: 'open', index: true }
  },
  { timestamps: true }
);
reportSchema.index({ targetType: 1, targetId: 1, reporter: 1 }, { unique: true });
export const Report = model('Report', reportSchema);

/* ---------- Uploaded images (resized client-side, verified server-side) ---------- */
const imageSchema = new Schema(
  {
    data: { type: Buffer, required: true },
    mime: { type: String, enum: ['image/webp', 'image/png', 'image/jpeg'], required: true },
    size: { type: Number, required: true },
    owner: { type: Schema.Types.ObjectId, ref: 'GuestSession', required: true, index: true }
  },
  { timestamps: true }
);
export const Image = model('Image', imageSchema);

/* ---------- Admin ---------- */
const adminUserSchema = new Schema(
  {
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    lastLoginAt: { type: Date, default: null }
  },
  { timestamps: true }
);
export const AdminUser = model('AdminUser', adminUserSchema);

const adminSessionSchema = new Schema(
  {
    tokenHash: { type: String, required: true, unique: true },
    admin: { type: Schema.Types.ObjectId, ref: 'AdminUser', required: true },
    expiresAt: { type: Date, required: true }
  },
  { timestamps: true }
);
adminSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const AdminSession = model('AdminSession', adminSessionSchema);

const auditLogSchema = new Schema(
  {
    admin: { type: Schema.Types.ObjectId, ref: 'AdminUser', required: true },
    adminName: { type: String, required: true },
    action: { type: String, required: true },
    targetType: { type: String, required: true },
    targetId: { type: String, required: true },
    details: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);
auditLogSchema.index({ createdAt: -1 });
export const AuditLog = model('AuditLog', auditLogSchema);

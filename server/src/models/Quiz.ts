import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { CATEGORY_SLUGS, DIFFICULTIES, LANGS, POINT_MODES, QUESTION_TYPES, QUIZ_VISIBILITY } from '@uzuz/shared';

const optionSchema = new Schema(
  {
    text: { type: String, required: true },
    correct: { type: Boolean, required: true }
  },
  { _id: false }
);

const questionSchema = new Schema(
  {
    type: { type: String, enum: QUESTION_TYPES, required: true },
    text: { type: String, required: true },
    image: { type: String, default: null },
    options: { type: [optionSchema], required: true },
    timeLimit: { type: Number, required: true },
    points: { type: String, enum: POINT_MODES, default: 'standard' },
    explanation: { type: String, default: '' }
  },
  { _id: false }
);

const quizSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    category: { type: String, enum: CATEGORY_SLUGS, required: true, index: true },
    language: { type: String, enum: LANGS, required: true },
    difficulty: { type: String, enum: DIFFICULTIES, required: true },
    tags: { type: [String], default: [] },
    visibility: { type: String, enum: QUIZ_VISIBILITY, default: 'public' },
    cover: { type: String, default: null },
    questions: { type: [questionSchema], required: true },
    questionCount: { type: Number, required: true },
    ownerSession: { type: Schema.Types.ObjectId, ref: 'GuestSession', default: null, index: true },
    editKeyHash: { type: String, default: null },
    authorName: { type: String, default: 'Mehmon' },
    isOfficial: { type: Boolean, default: false },
    plays: { type: Number, default: 0 },
    hidden: { type: Boolean, default: false },
    featured: { type: Boolean, default: false },
    reportsCount: { type: Number, default: 0 }
  },
  { timestamps: true }
);

quizSchema.index({ title: 'text', description: 'text', tags: 'text' }, { default_language: 'none' });
quizSchema.index({ visibility: 1, hidden: 1, plays: -1 });
quizSchema.index({ visibility: 1, hidden: 1, createdAt: -1 });

export type QuizAttrs = InferSchemaType<typeof quizSchema>;
export type QuizDoc = HydratedDocument<QuizAttrs>;
export const Quiz = model('Quiz', quizSchema);

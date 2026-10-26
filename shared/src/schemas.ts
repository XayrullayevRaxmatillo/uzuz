import { z } from 'zod';
import {
  AVATAR_COLORS,
  AVATAR_COUNT,
  CATEGORY_SLUGS,
  DIFFICULTIES,
  LANGS,
  MAX_PLAYERS_DEFAULT,
  MAX_PLAYERS_LIMIT,
  POINT_MODES,
  QUESTION_TYPES,
  QUIZ_MAX_QUESTIONS,
  QUIZ_VISIBILITY,
  REPORT_REASONS,
  ROOM_CODE_LENGTH,
  ROOM_MODES,
  SKILL_LEVELS,
  TEAM_CAPACITY_MAX,
  TEAM_CAPACITY_MIN,
  TEAM_JOIN_POLICIES,
  TEAM_VISIBILITY,
  TIME_LIMITS,
  TIME_MULTIPLIERS
} from './constants';
import { containsProfanity, isReservedName } from './profanity';

/** Latin (incl. Uzbek o‘ g‘), Cyrillic (incl. Uzbek ў қ ғ ҳ), digits, underscore, space, dot, dash. */
const NICK_RE = /^[A-Za-zÀ-ɏЀ-ӿ0-9_ ‘’ʻʼ'.\-]+$/;

export const nicknameSchema = z
  .string()
  .transform((s) => s.replace(/\s+/g, ' ').trim())
  .pipe(
    z
      .string()
      .min(2)
      .max(20)
      .regex(NICK_RE)
      .refine((s) => !containsProfanity(s), { message: 'profanity' })
      .refine((s) => !isReservedName(s), { message: 'reserved' })
  );

export const avatarSchema = z.number().int().min(0).max(AVATAR_COUNT - 1);
export const avatarColorSchema = z.number().int().min(0).max(AVATAR_COLORS.length - 1);

export const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/i, 'invalid id');

/** Internal uploaded image path or an https URL. */
export const imageRefSchema = z
  .string()
  .max(500)
  .refine((v) => /^\/api\/v1\/images\/[a-f0-9]{24}$/.test(v) || /^https:\/\/[^\s<>"']+$/.test(v), {
    message: 'invalid image'
  });

const cleanText = (min: number, max: number) =>
  z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(min).max(max));

export const optionSchema = z
  .object({
    text: cleanText(1, 120),
    correct: z.boolean()
  })
  .strict();

export const questionSchema = z
  .object({
    type: z.enum(QUESTION_TYPES),
    text: cleanText(1, 300),
    image: imageRefSchema.nullable().optional(),
    options: z.array(optionSchema).min(2).max(4),
    timeLimit: z.number().refine((v) => (TIME_LIMITS as readonly number[]).includes(v), { message: 'invalid time' }),
    points: z.enum(POINT_MODES),
    explanation: z.string().trim().max(300).optional().default('')
  })
  .strict()
  .superRefine((q, ctx) => {
    const correct = q.options.filter((o) => o.correct).length;
    if (correct !== 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['options'], message: 'exactly_one_correct' });
    }
    if (q.type === 'boolean' && q.options.length !== 2) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['options'], message: 'boolean_two_options' });
    }
  });

export const quizInputSchema = z
  .object({
    title: cleanText(3, 100).refine((s) => !containsProfanity(s), { message: 'profanity' }),
    description: z.string().trim().max(500).optional().default(''),
    category: z.enum(CATEGORY_SLUGS),
    language: z.enum(LANGS),
    difficulty: z.enum(DIFFICULTIES),
    tags: z.array(cleanText(1, 24)).max(5).optional().default([]),
    visibility: z.enum(QUIZ_VISIBILITY).optional().default('public'),
    cover: imageRefSchema.nullable().optional(),
    questions: z.array(questionSchema).min(1).max(QUIZ_MAX_QUESTIONS)
  })
  .strict();

export type QuestionInput = z.infer<typeof questionSchema>;
export type QuizInput = z.infer<typeof quizInputSchema>;

export const teamInputSchema = z
  .object({
    name: cleanText(3, 30).refine((s) => !containsProfanity(s), { message: 'profanity' }),
    description: z.string().trim().max(200).optional().default(''),
    emoji: z.string().trim().min(1).max(8).optional().default('⚡'),
    subject: z.enum(CATEGORY_SLUGS),
    language: z.enum(LANGS),
    level: z.enum(SKILL_LEVELS),
    capacity: z.number().int().min(TEAM_CAPACITY_MIN).max(TEAM_CAPACITY_MAX),
    visibility: z.enum(TEAM_VISIBILITY),
    joinPolicy: z.enum(TEAM_JOIN_POLICIES)
  })
  .strict();
export type TeamInput = z.infer<typeof teamInputSchema>;

export const teamUpdateSchema = z
  .object({
    description: z.string().trim().max(200).optional(),
    capacity: z.number().int().min(TEAM_CAPACITY_MIN).max(TEAM_CAPACITY_MAX).optional(),
    visibility: z.enum(TEAM_VISIBILITY).optional(),
    joinPolicy: z.enum(TEAM_JOIN_POLICIES).optional()
  })
  .strict();

export const roomSettingsSchema = z
  .object({
    maxPlayers: z.number().int().min(1).max(MAX_PLAYERS_LIMIT).optional().default(MAX_PLAYERS_DEFAULT),
    shuffleQuestions: z.boolean().optional().default(false),
    shuffleAnswers: z.boolean().optional().default(false),
    timeMultiplier: z
      .number()
      .refine((v) => (TIME_MULTIPLIERS as readonly number[]).includes(v))
      .optional()
      .default(1),
    autoAdvance: z.boolean().optional().default(false),
    isPublic: z.boolean().optional().default(false)
  })
  .strict();
export type RoomSettings = z.infer<typeof roomSettingsSchema>;

export const roomCreateSchema = z
  .object({
    quizId: objectIdSchema,
    mode: z.enum(ROOM_MODES),
    settings: roomSettingsSchema.optional().default({})
  })
  .strict();

export const sessionUpdateSchema = z
  .object({
    nickname: nicknameSchema.optional(),
    avatar: avatarSchema.optional(),
    color: avatarColorSchema.optional(),
    hideFromLeaderboard: z.boolean().optional()
  })
  .strict();

export const reportSchema = z
  .object({
    targetType: z.enum(['quiz', 'team', 'player']),
    targetId: z.string().min(1).max(64),
    reason: z.enum(REPORT_REASONS),
    details: z.string().trim().max(500).optional().default('')
  })
  .strict();

/* ---------- Socket payloads ---------- */

export const roomCodeSchema = z
  .string()
  .transform((s) => s.toUpperCase().replace(/[^A-Z0-9]/g, ''))
  .pipe(z.string().length(ROOM_CODE_LENGTH));

export const roomJoinSchema = z
  .object({
    code: roomCodeSchema,
    role: z.enum(['host', 'player']),
    nickname: z.string().max(40).optional(),
    avatar: avatarSchema.optional(),
    color: avatarColorSchema.optional()
  })
  .strict();

export const codeOnlySchema = z.object({ code: roomCodeSchema }).strict();

export const answerSubmitSchema = z
  .object({
    code: roomCodeSchema,
    questionIndex: z.number().int().min(0).max(QUIZ_MAX_QUESTIONS),
    option: z.number().int().min(0).max(3)
  })
  .strict();

export const kickSchema = z.object({ code: roomCodeSchema, pid: z.string().min(1).max(32) }).strict();
export const lockSchema = z.object({ code: roomCodeSchema, locked: z.boolean() }).strict();
export const teamSelectSchema = z.object({ code: roomCodeSchema, teamKey: z.string().min(1).max(40) }).strict();

import { Schema, model, type InferSchemaType } from 'mongoose';

const categorySchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: {
      uz: { type: String, required: true },
      ru: { type: String, required: true },
      en: { type: String, required: true }
    },
    icon: { type: String, default: '✨' },
    color: { type: String, default: '#7C3AED' },
    order: { type: Number, default: 0 }
  },
  { timestamps: true }
);

export type CategoryAttrs = InferSchemaType<typeof categorySchema>;
export const Category = model('Category', categorySchema);

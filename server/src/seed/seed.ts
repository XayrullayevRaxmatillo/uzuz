import { quizInputSchema, slugify } from '@uzuz/shared';
import { Category } from '../models/Category';
import { Quiz } from '../models/Quiz';
import { CATEGORIES, QUIZZES } from './data';

/**
 * Seeds categories and official "UZUZ jamoasi" quizzes. Play counts always start at 0 —
 * no fake statistics. Each seed quiz is validated with the same schema as user quizzes.
 */
export async function seedDatabase({ reset }: { reset: boolean }): Promise<{ categories: number; quizzes: number }> {
  for (const [order, c] of CATEGORIES.entries()) {
    await Category.updateOne({ slug: c.slug }, { $set: { name: c.name, icon: c.icon, color: c.color, order } }, { upsert: true });
  }

  if (reset) await Quiz.deleteMany({ isOfficial: true });

  let created = 0;
  for (const seed of QUIZZES) {
    const { featured, ...rest } = seed;
    const input = quizInputSchema.parse({ ...rest, visibility: 'public' });
    const slug = slugify(input.title);
    if (await Quiz.exists({ slug })) continue;
    await Quiz.create({
      ...input,
      slug,
      questionCount: input.questions.length,
      authorName: 'UZUZ jamoasi',
      isOfficial: true,
      featured: !!featured,
      plays: 0,
      ownerSession: null,
      editKeyHash: null
    });
    created++;
  }

  return { categories: CATEGORIES.length, quizzes: created };
}

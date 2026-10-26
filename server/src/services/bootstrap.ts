import bcrypt from 'bcryptjs';
import { env } from '../config/env';
import { Category } from '../models/Category';
import { AdminUser } from '../models/misc';
import { seedDatabase } from '../seed/seed';

/** First-run setup: seed official content when the DB is empty; create the first admin from env. */
export async function bootstrap(): Promise<void> {
  if ((await Category.estimatedDocumentCount()) === 0) {
    console.log('🌱 Empty database — seeding categories and official quizzes…');
    const r = await seedDatabase({ reset: false });
    console.log(`🌱 Seeded ${r.categories} categories and ${r.quizzes} quizzes.`);
  }

  if (env.ADMIN_USERNAME && env.ADMIN_PASSWORD && (await AdminUser.estimatedDocumentCount()) === 0) {
    if (env.ADMIN_PASSWORD.length < 10) {
      console.warn('⚠️  ADMIN_PASSWORD must be at least 10 characters — admin not created.');
      return;
    }
    await AdminUser.create({ username: env.ADMIN_USERNAME.toLowerCase(), passwordHash: await bcrypt.hash(env.ADMIN_PASSWORD, 12) });
    console.log(`🔐 Admin "${env.ADMIN_USERNAME}" created from environment.`);
  }
}

/**
 * Usage: npm run seed            — add missing categories/official quizzes
 *        npm run seed -- --reset — replace all official quizzes with the seed set
 */
import { connectDb, disconnectDb } from '../config/db';
import { seedDatabase } from '../seed/seed';

async function main() {
  await connectDb();
  const reset = process.argv.includes('--reset');
  const r = await seedDatabase({ reset });
  console.log(`✅ Categories: ${r.categories}, official quizzes: ${r.quizzes}${reset ? ' (reset)' : ''}`);
  await disconnectDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

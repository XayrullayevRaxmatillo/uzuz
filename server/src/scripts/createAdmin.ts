/**
 * Usage: npm run admin:create -- <username> <password>
 * Requires MONGODB_URI (stop the dev server first if you use the embedded database).
 */
import bcrypt from 'bcryptjs';
import { connectDb, disconnectDb } from '../config/db';
import { AdminUser } from '../models/misc';

async function main() {
  const [username, password] = process.argv.slice(2);
  if (!username || !password) {
    console.error('Usage: npm run admin:create -- <username> <password>');
    process.exit(1);
  }
  if (password.length < 10) {
    console.error('Password must be at least 10 characters.');
    process.exit(1);
  }
  await connectDb();
  const passwordHash = await bcrypt.hash(password, 12);
  await AdminUser.updateOne({ username: username.toLowerCase() }, { $set: { passwordHash } }, { upsert: true });
  console.log(`✅ Admin "${username.toLowerCase()}" saved.`);
  await disconnectDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

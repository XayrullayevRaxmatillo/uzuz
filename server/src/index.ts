import http from 'node:http';
import { env } from './config/env';
import { connectDb, disconnectDb } from './config/db';
import { createApp } from './app';
import { attachSockets } from './sockets';
import { games } from './game/manager';
import { bootstrap } from './services/bootstrap';

async function main() {
  await connectDb();
  await bootstrap();
  await games.deactivateStale();

  const app = createApp();
  const server = http.createServer(app);
  const io = attachSockets(server);

  server.listen(env.PORT, () => {
    console.log(`🚀 UZUZ server listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });

  let closing = false;
  const shutdown = async (signal: string) => {
    if (closing) return;
    closing = true;
    console.log(`\n${signal} received — shutting down…`);
    games.shutdown();
    io.close();
    server.close();
    await disconnectDb().catch(() => undefined);
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});

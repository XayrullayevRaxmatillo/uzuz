import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { env } from './env';

let memoryServer: { stop: () => Promise<unknown> } | null = null;

export async function connectDb(): Promise<void> {
  mongoose.set('strictQuery', true);
  let uri = env.MONGODB_URI;

  if (!uri) {
    // Development convenience: embedded MongoDB persisted to server/.mongo-data
    // Interop-safe import (CommonJS package loaded from ESM).
    const mod = (await import('mongodb-memory-server-core')) as unknown as {
      MongoMemoryServer?: typeof import('mongodb-memory-server-core').MongoMemoryServer;
      default?: { MongoMemoryServer: typeof import('mongodb-memory-server-core').MongoMemoryServer };
    };
    const MongoMemoryServer = mod.MongoMemoryServer ?? mod.default!.MongoMemoryServer;
    const dbPath = path.resolve(process.cwd(), '.mongo-data');
    fs.mkdirSync(dbPath, { recursive: true });
    console.log('🗄️  MONGODB_URI is empty — starting embedded MongoDB (first run downloads ~100MB)…');
    const server = await MongoMemoryServer.create({ instance: { dbPath, storageEngine: 'wiredTiger' } });
    memoryServer = server;
    uri = server.getUri('uzuz');
  }

  await mongoose.connect(uri, { autoIndex: true });
  console.log(`🗄️  MongoDB connected (${mongoose.connection.name})`);
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
}

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { Router } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import { env } from './config/env';
import { sessionMiddleware } from './middleware/session';
import { apiLimiter } from './middleware/rateLimit';
import { errorHandler, ApiError } from './utils/http';
import { sessionRouter } from './routes/session';
import { categoriesRouter, quizzesRouter } from './routes/quizzes';
import { roomsRouter } from './routes/rooms';
import { teamsRouter } from './routes/teams';
import { leaderboardRouter } from './routes/leaderboard';
import { imagesRouter } from './routes/images';
import { reportsRouter } from './routes/reports';
import { adminRouter } from './routes/admin';

const here = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(here, '../../client/dist');

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (env.TRUST_PROXY > 0) app.set('trust proxy', env.TRUST_PROXY);

  const serveClient = env.SERVE_CLIENT === 'true' || (env.SERVE_CLIENT === 'auto' && fs.existsSync(path.join(clientDist, 'index.html')));

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
          connectSrc: ["'self'", 'ws:', 'wss:', ...env.clientOrigins],
          workerSrc: ["'self'"],
          manifestSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"]
        }
      },
      crossOriginResourcePolicy: { policy: 'same-site' }
    })
  );
  app.use(compression());
  app.use(cors({ origin: env.clientOrigins, credentials: true }));
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true, db: mongoose.connection.readyState === 1, time: Date.now() });
  });

  const api = Router();
  api.use(apiLimiter);
  // Admin has its own cookie and does not need a guest session.
  api.use('/admin', adminRouter);
  api.use(sessionMiddleware);
  api.use('/session', sessionRouter);
  api.use('/categories', categoriesRouter);
  api.use('/quizzes', quizzesRouter);
  api.use('/rooms', roomsRouter);
  api.use('/teams', teamsRouter);
  api.use('/leaderboard', leaderboardRouter);
  api.use('/images', imagesRouter);
  api.use('/reports', reportsRouter);
  api.use((_req, _res, next) => next(new ApiError(404, 'NOT_FOUND')));
  app.use('/api/v1', api);

  if (serveClient) {
    app.use(
      express.static(clientDist, {
        index: false,
        setHeaders: (res, file) => {
          if (file.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      })
    );
    // SPA fallback for client-side routes.
    app.get(/^\/(?!api\/|socket\.io\/).*/, (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(clientDist, 'index.html'));
    });
    console.log('🖥️  Serving client from', clientDist);
  }

  app.use(errorHandler);
  return app;
}

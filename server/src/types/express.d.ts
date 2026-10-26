import type { GuestSessionDoc } from '../models/GuestSession';

declare global {
  namespace Express {
    interface Request {
      guest: GuestSessionDoc;
      admin?: { id: string; username: string };
    }
  }
}

export {};

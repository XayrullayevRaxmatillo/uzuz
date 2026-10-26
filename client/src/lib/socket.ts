import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@uzuz/shared';
import { API_BASE } from './api';

export type UzuzSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: UzuzSocket | null = null;
let clockOffset = 0;

/**
 * One shared connection per tab. The server authenticates it with the httpOnly guest cookie,
 * so the REST session must exist before connecting (SessionProvider guarantees that).
 */
export function getSocket(): UzuzSocket {
  if (!socket) {
    socket = io(API_BASE || undefined, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.4,
      autoConnect: true
    });
    socket.on('connect', syncClock);
  }
  return socket;
}

/** Estimate server clock offset (NTP-style, half round-trip). */
function syncClock() {
  const s = socket;
  if (!s) return;
  const samples: number[] = [];
  const once = () => {
    const t0 = Date.now();
    s.emit('time:sync', (serverNow: number) => {
      const t1 = Date.now();
      samples.push(serverNow + (t1 - t0) / 2 - t1);
      if (samples.length < 3) once();
      else clockOffset = samples.sort((a, b) => a - b)[1];
    });
  };
  once();
}

/** Current time in the server's clock. */
export function serverNow(): number {
  return Date.now() + clockOffset;
}

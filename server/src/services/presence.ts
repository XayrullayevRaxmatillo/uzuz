/** Tracks which guest sessions currently have at least one open socket (team "online" dots). */
const counts = new Map<string, number>();

export const presence = {
  connect(sessionId: string) {
    counts.set(sessionId, (counts.get(sessionId) ?? 0) + 1);
  },
  disconnect(sessionId: string) {
    const n = (counts.get(sessionId) ?? 1) - 1;
    if (n <= 0) counts.delete(sessionId);
    else counts.set(sessionId, n);
  },
  isOnline(sessionId: string): boolean {
    return (counts.get(sessionId) ?? 0) > 0;
  }
};

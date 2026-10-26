import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { SessionDTO } from '@uzuz/shared';
import { api, ApiError } from '../lib/api';
import { KEYS, storage, type LocalProfile } from '../lib/storage';

interface SessionState {
  session: SessionDTO | null;
  loading: boolean;
  error: ApiError | null;
  refresh: () => Promise<SessionDTO | null>;
  update: (patch: Partial<Pick<SessionDTO, 'nickname' | 'avatar' | 'color' | 'hideFromLeaderboard'>>) => Promise<SessionDTO>;
  setSession: (s: SessionDTO) => void;
  /** Locally remembered nickname/avatar for quick joining. */
  profile: LocalProfile | null;
  saveProfile: (p: LocalProfile) => void;
}

const Ctx = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [profile, setProfile] = useState<LocalProfile | null>(() => storage.get<LocalProfile | null>(KEYS.profile, null));

  const refresh = useCallback(async () => {
    try {
      const s = await api<SessionDTO>('/session');
      setSession(s);
      setError(null);
      return s;
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, 'NETWORK'));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const update = useCallback<SessionState['update']>(async (patch) => {
    const s = await api<SessionDTO>('/session', { method: 'PATCH', body: patch });
    setSession(s);
    return s;
  }, []);

  const saveProfile = useCallback((p: LocalProfile) => {
    setProfile(p);
    storage.set(KEYS.profile, p);
  }, []);

  const value = useMemo(
    () => ({ session, loading, error, refresh, update, setSession, profile, saveProfile }),
    [session, loading, error, refresh, update, profile, saveProfile]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession outside provider');
  return v;
}

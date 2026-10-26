import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROOM_CODE_LENGTH, isValidRoomCode, normalizeRoomCode } from '@uzuz/shared';
import { CodeInput } from '../components/CodeInput';
import { Button, EmptyState, Skeleton } from '../components/ui';
import { api } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { useAsync } from '../hooks/useAsync';

interface PublicRoom {
  code: string;
  quizTitle: string;
  mode: string;
  players: number;
  maxPlayers: number;
  language: string;
}

export default function Join() {
  const { t } = useTranslation();
  const params = useParams();
  const navigate = useNavigate();
  const [code, setCode] = useState(() => normalizeRoomCode(params.code ?? '').slice(0, ROOM_CODE_LENGTH));
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const rooms = useAsync((signal) => api<{ items: PublicRoom[] }>('/rooms/public', { signal }), []);

  const go = async (value = code) => {
    if (!isValidRoomCode(value)) {
      setError(t('errors.ROOM_NOT_FOUND'));
      return;
    }
    setChecking(true);
    setError(null);
    try {
      const info = await api<{ isHost: boolean; mode: string }>(`/rooms/${value}`);
      navigate(info.isHost && info.mode !== 'solo' ? `/room/${value}/host` : `/room/${value}/play`);
    } catch (err) {
      setError(errorMessage(t, err));
    } finally {
      setChecking(false);
    }
  };

  // Deep link /join/ABC234 → validate and continue straight away.
  useEffect(() => {
    const c = normalizeRoomCode(params.code ?? '');
    if (c.length === ROOM_CODE_LENGTH) void go(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.code]);

  return (
    <div className="container-page max-w-3xl py-10 sm:py-16">
      <section className="panel px-5 py-10 text-center sm:px-10">
        <h1 className="text-3xl font-black sm:text-4xl">{t('join.title')}</h1>
        <p className="mx-auto mt-2 max-w-md text-muted">{t('join.subtitle')}</p>
        <form
          className="mt-8 space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            void go();
          }}
        >
          <CodeInput value={code} onChange={(v) => { setCode(v); setError(null); }} onComplete={(v) => void go(v)} autoFocus={!params.code} invalid={!!error} />
          {error ? (
            <p className="font-semibold text-coral" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" size="xl" loading={checking} disabled={code.length !== ROOM_CODE_LENGTH} className="w-full sm:w-auto">
            {t('join.continue')}
          </Button>
        </form>
      </section>

      <section className="mt-12">
        <h2 className="mb-4 text-xl font-bold">{t('join.publicRooms')}</h2>
        {rooms.loading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        ) : rooms.data && rooms.data.items.length ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {rooms.data.items.map((r) => (
              <li key={r.code}>
                <Link to={`/room/${r.code}/play`} className="flex items-center justify-between gap-3 rounded-card border border-line/10 bg-surface/60 p-4 transition hover:border-cyan">
                  <span className="min-w-0">
                    <span className="block truncate font-bold">{r.quizTitle}</span>
                    <span className="text-sm text-muted">
                      {t(`modes.${r.mode}`)} · {r.language.toUpperCase()} · {t('game.playersCount', { count: r.players })}
                    </span>
                  </span>
                  <span className="font-display text-lg font-black tracking-widest text-cyan-600 dark:text-cyan">{r.code}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title={t('join.noPublicRooms')}
            text={t('join.noPublicRoomsText')}
            action={
              <Link to="/quizzes" className="font-bold text-cyan-600 underline underline-offset-4 dark:text-cyan">
                {t('join.hostOne')}
              </Link>
            }
          />
        )}
      </section>
    </div>
  );
}

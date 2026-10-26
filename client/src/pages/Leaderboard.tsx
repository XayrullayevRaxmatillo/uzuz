import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, qs } from '../lib/api';
import { useAsync } from '../hooks/useAsync';
import { errorMessage } from '../lib/errors';
import { formatNumber } from '../i18n';
import { Avatar } from '../components/Avatar';
import { Button, EmptyState, ErrorState, Skeleton } from '../components/ui';

type Scope = 'global' | 'weekly' | 'teams';

interface Row {
  rank: number;
  nickname?: string;
  name?: string | null;
  emoji?: string;
  id?: string;
  avatar?: number;
  color?: number;
  xp?: number;
  score?: number;
  level?: number;
  games?: number;
  wins?: number;
  accuracy?: number;
  members?: number;
  isYou?: boolean;
}

interface Resp {
  scope: string;
  page: number;
  pages: number;
  items: Row[];
  you?: { rank: number; xp: number } | null;
}

const MEDAL = ['🥇', '🥈', '🥉'];

export default function Leaderboard() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const scope = (['global', 'weekly', 'teams'].includes(params.get('scope') ?? '') ? params.get('scope') : 'global') as Scope;
  const [page, setPage] = useState(1);
  const data = useAsync((signal) => api<Resp>(`/leaderboard${qs({ scope, page })}`, { signal }), [scope, page]);

  const setScope = (s: Scope) => {
    setPage(1);
    setParams(s === 'global' ? {} : { scope: s }, { replace: true });
  };

  return (
    <div className="container-page max-w-4xl py-10">
      <h1 className="text-3xl font-black sm:text-4xl">{t('leaderboard.title')}</h1>
      <p className="mt-1 text-muted">{t('leaderboard.subtitle')}</p>

      <div className="my-6 inline-flex rounded-full border border-line/15 bg-surface/50 p-1" role="tablist">
        {(['global', 'weekly', 'teams'] as const).map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={scope === s}
            onClick={() => setScope(s)}
            className={`rounded-full px-4 py-2 text-sm font-bold transition ${scope === s ? 'bg-ink text-bg' : 'text-muted hover:text-ink'}`}
          >
            {t(`leaderboard.${s}`)}
          </button>
        ))}
      </div>

      {data.data?.you ? (
        <p className="mb-4 rounded-card bg-cyan/10 px-4 py-3 font-bold">{t('leaderboard.yourRank', { rank: data.data.you.rank, xp: formatNumber(data.data.you.xp) })}</p>
      ) : null}

      {data.loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : data.error ? (
        <ErrorState message={errorMessage(t, data.error)} onRetry={data.reload} />
      ) : data.data && data.data.items.length ? (
        <>
          <ol className="space-y-2">
            {data.data.items.map((r) => (
              <li
                key={`${r.rank}-${r.id ?? r.nickname}`}
                className={`flex items-center gap-3 rounded-card border px-4 py-3 ${r.isYou ? 'border-cyan bg-cyan/10' : 'border-line/10 bg-surface/60'}`}
              >
                <span className="w-9 text-center font-display text-lg font-black text-muted">{r.rank <= 3 ? MEDAL[r.rank - 1] : r.rank}</span>
                {scope === 'teams' ? (
                  <>
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-line/5 text-xl" aria-hidden="true">
                      {r.emoji}
                    </span>
                    <span className="min-w-0 flex-1">
                      {r.name ? (
                        <Link to={`/teams/${r.id}`} className="block truncate font-bold hover:underline">
                          {r.name}
                        </Link>
                      ) : (
                        <span className="block truncate font-bold text-muted">{t('leaderboard.privateTeam')}</span>
                      )}
                      <span className="text-xs text-muted">
                        {t('teams.games', { count: r.games ?? 0 })} · {t('leaderboard.wins', { count: r.wins ?? 0 })} · {t('game.membersCount', { count: r.members ?? 0 })}
                      </span>
                    </span>
                    <span className="font-display text-lg font-extrabold">{formatNumber(r.score ?? 0)}</span>
                  </>
                ) : (
                  <>
                    <Avatar avatar={r.avatar ?? 0} color={r.color ?? 0} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">
                        {r.nickname} {r.isYou ? <span className="text-xs text-cyan-600 dark:text-cyan">({t('leaderboard.you')})</span> : null}
                      </span>
                      <span className="text-xs text-muted">
                        {scope === 'global'
                          ? `${t('game.level', { level: r.level })} · ${t('leaderboard.wins', { count: r.wins ?? 0 })} · ${t('game.accuracy')} ${r.accuracy}%`
                          : t('teams.games', { count: r.games ?? 0 })}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block font-display text-lg font-extrabold">{formatNumber(r.xp ?? 0)}</span>
                      <span className="text-xs font-bold text-muted">XP</span>
                    </span>
                  </>
                )}
              </li>
            ))}
          </ol>
          {data.data.pages > 1 ? (
            <div className="mt-6 flex items-center justify-center gap-3">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                {t('common.back')}
              </Button>
              <span className="text-sm font-semibold text-muted">
                {page} / {data.data.pages}
              </span>
              <Button variant="secondary" size="sm" disabled={page >= data.data.pages} onClick={() => setPage(page + 1)}>
                {t('common.next')}
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <EmptyState title={t('leaderboard.emptyTitle')} text={t('leaderboard.emptyText')} />
      )}

      <p className="mt-8 text-sm text-muted">
        {t('leaderboard.privacy')}{' '}
        <Link to="/me" className="font-bold underline underline-offset-4">
          {t('nav.me')}
        </Link>
      </p>
    </div>
  );
}

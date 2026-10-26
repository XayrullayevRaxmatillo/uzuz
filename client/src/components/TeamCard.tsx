import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TeamCardDTO } from '@uzuz/shared';
import { categoryMeta } from '../lib/categories';
import { Avatar } from './Avatar';
import { Badge } from './ui';
import { relativeTime } from '../i18n';

export function CapacityBar({ count, capacity }: { count: number; capacity: number }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2" aria-label={t('teams.spots', { count, capacity })}>
      <div className="flex gap-1">
        {Array.from({ length: capacity }).map((_, i) => (
          <span key={i} className={`h-2 w-4 rounded-full ${i < count ? 'bg-cyan' : 'bg-line/15'}`} />
        ))}
      </div>
      <span className="text-xs font-bold text-muted">{t('teams.spots', { count, capacity })}</span>
    </div>
  );
}

export function TeamCard({ team, reasons, extra }: { team: TeamCardDTO; reasons?: string[]; extra?: ReactNode }) {
  const { t } = useTranslation();
  const cat = categoryMeta(team.subject);
  const full = team.memberCount >= team.capacity;
  return (
    <article className="relative flex flex-col gap-4 rounded-card border border-line/10 bg-surface/60 p-5 transition hover:border-line/25">
      <div className="flex items-start gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-2xl" style={{ background: `${cat.color}26` }} aria-hidden="true">
          {team.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-base font-bold">
            <Link to={`/teams/${team.id}`} className="after:absolute after:inset-0 focus-visible:outline-none">
              {team.name}
            </Link>
          </h3>
          <p className="text-xs font-semibold text-muted">{t('teams.activeAgo', { time: relativeTime(team.lastActiveAt) })}</p>
        </div>
        {team.joinPolicy !== 'open' || team.visibility === 'private' ? (
          <Badge tone="amber">{team.visibility === 'private' ? t('teams.private') : t(`teams.policy.${team.joinPolicy}`)}</Badge>
        ) : null}
      </div>
      {team.description ? <p className="line-clamp-2 text-sm text-muted">{team.description}</p> : null}
      <div className="flex flex-wrap gap-1.5">
        <Badge tone="violet">
          {cat.icon} {t(`categories.${team.subject}`)}
        </Badge>
        <Badge>{team.language.toUpperCase()}</Badge>
        <Badge tone="cyan">{t(`levels.${team.level}`)}</Badge>
      </div>
      {reasons && reasons.length ? (
        <div className="flex flex-wrap gap-1.5">
          {reasons.map((r) => (
            <span key={r} className="rounded-full border border-emerald-400/30 px-2 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-300">
              ✓ {t(`teams.reasons.${r}`)}
            </span>
          ))}
        </div>
      ) : null}
      <div className="mt-auto flex items-center justify-between gap-3">
        <div className="flex -space-x-2">
          {team.members.slice(0, 5).map((m) => (
            <Avatar key={m.pid} avatar={m.avatar} color={m.color} size={30} className="rounded-full ring-2 ring-bg" title={m.nickname} />
          ))}
        </div>
        {full ? <Badge tone="coral">{t('teams.full')}</Badge> : <CapacityBar count={team.memberCount} capacity={team.capacity} />}
      </div>
      {extra ? <div className="relative z-10">{extra}</div> : null}
    </article>
  );
}

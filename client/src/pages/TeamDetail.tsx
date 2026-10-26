import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TeamCardDTO, TeamMemberDTO } from '@uzuz/shared';
import { api } from '../lib/api';
import { useAsync } from '../hooks/useAsync';
import { errorMessage } from '../lib/errors';
import { absoluteUrl, copyText, shareLink } from '../lib/share';
import { categoryMeta } from '../lib/categories';
import { formatNumber, relativeTime } from '../i18n';
import { useToast } from '../context/ToastContext';
import { Avatar } from '../components/Avatar';
import { CapacityBar } from '../components/TeamCard';
import { ReportModal } from '../components/ReportModal';
import { Badge, Button, ButtonLink, Center, PageLoader } from '../components/ui';
import { IconCopy, IconFlag, IconShare } from '../components/icons';

interface TeamDetailDTO extends Omit<TeamCardDTO, 'members'> {
  members: TeamMemberDTO[];
  you: { isMember: boolean; isOwner: boolean; pendingRequest: boolean };
  inviteCode: string | null;
  requestCount: number;
}

interface JoinRequest {
  id: string;
  pid: string;
  nickname: string;
  avatar: number;
  color: number;
}

export default function TeamDetail() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const inviteFromLink = params.get('code') ?? '';
  const navigate = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const team = useAsync(
    (signal) => api<TeamDetailDTO>(`/teams/${id}${inviteFromLink ? `?code=${encodeURIComponent(inviteFromLink)}` : ''}`, { signal }),
    [id, inviteFromLink]
  );
  const isOwner = !!team.data?.you.isOwner;
  const requests = useAsync(
    (signal) => (isOwner ? api<{ items: JoinRequest[] }>(`/teams/${id}/requests`, { signal }) : Promise.resolve({ items: [] as JoinRequest[] })),
    [id, isOwner]
  );

  if (team.loading && !team.data) return <PageLoader />;
  if (team.error || !team.data) {
    return (
      <Center>
        <h1 className="text-2xl font-bold">{t('teams.notFoundTitle')}</h1>
        <p className="max-w-md text-muted">{errorMessage(t, team.error ?? 'TEAM_NOT_FOUND')}</p>
        <ButtonLink to="/teams">{t('nav.teams')}</ButtonLink>
      </Center>
    );
  }

  const d = team.data;
  const cat = categoryMeta(d.subject);
  const full = d.memberCount >= d.capacity;

  const act = async (fn: () => Promise<unknown>, success?: string) => {
    setBusy(true);
    try {
      await fn();
      if (success) toast.success(success);
      team.reload();
      requests.reload();
    } catch (err) {
      toast.error(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  const join = () =>
    act(async () => {
      const r = await api<{ status: 'joined' | 'requested' }>(`/teams/${id}/join`, { method: 'POST', body: inviteFromLink ? { code: inviteFromLink } : {} });
      toast.success(r.status === 'joined' ? t('teams.joined') : t('teams.requested'));
    });

  const inviteLink = d.inviteCode ? absoluteUrl(`/teams/${d.id}?code=${d.inviteCode}`) : absoluteUrl(`/teams/${d.id}`);

  return (
    <div className="container-page max-w-5xl py-10">
      <nav className="mb-6 text-sm font-semibold text-muted">
        <Link to="/teams" className="hover:text-ink">
          {t('nav.teams')}
        </Link>
      </nav>

      <section className="panel overflow-hidden">
        <div className="h-24 sm:h-32" style={{ background: `linear-gradient(120deg, ${cat.color}, ${cat.color}30)` }} aria-hidden="true" />
        <div className="px-6 pb-6 sm:px-8">
          <div className="-mt-10 flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-end gap-4">
              <div className="grid h-20 w-20 place-items-center rounded-3xl border-4 border-bg-2 bg-surface text-4xl shadow-lift" aria-hidden="true">
                {d.emoji}
              </div>
              <div className="pb-1">
                <h1 className="text-2xl font-black sm:text-3xl">{d.name}</h1>
                <p className="text-sm font-semibold text-muted">{t('teams.activeAgo', { time: relativeTime(d.lastActiveAt) })}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {d.you.isMember ? (
                <Button
                  variant="danger"
                  loading={busy}
                  onClick={() => {
                    if (window.confirm(isOwner ? t('teams.confirmLeaveOwner') : t('teams.confirmLeave'))) {
                      void act(() => api(`/teams/${id}/leave`, { method: 'POST' }), t('teams.left')).then(() => navigate('/teams'));
                    }
                  }}
                >
                  {t('teams.leave')}
                </Button>
              ) : d.you.pendingRequest ? (
                <Badge tone="amber" className="!py-2 !text-sm">
                  {t('teams.requestPending')}
                </Badge>
              ) : (
                <Button onClick={join} loading={busy} disabled={full}>
                  {full ? t('teams.full') : d.joinPolicy === 'approval' && !inviteFromLink ? t('teams.requestJoin') : t('teams.join')}
                </Button>
              )}
              <Button
                variant="secondary"
                onClick={async () => {
                  const r = await shareLink({ title: d.name, text: t('teams.inviteText'), url: inviteLink });
                  if (r === 'copied') toast.success(t('common.linkCopied'));
                }}
              >
                <IconShare size={16} /> {t('teams.invite')}
              </Button>
            </div>
          </div>

          {d.description ? <p className="mt-5 max-w-2xl text-muted">{d.description}</p> : null}
          <div className="mt-5 flex flex-wrap gap-2">
            <Badge tone="violet">
              {cat.icon} {t(`categories.${d.subject}`)}
            </Badge>
            <Badge>{t(`languages.${d.language}`)}</Badge>
            <Badge tone="cyan">{t(`levels.${d.level}`)}</Badge>
            <Badge tone="amber">{d.visibility === 'private' ? t('teams.private') : t(`teams.policy.${d.joinPolicy}`)}</Badge>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-6">
            <CapacityBar count={d.memberCount} capacity={d.capacity} />
            <span className="text-sm font-semibold text-muted">
              {t('teams.score', { score: formatNumber(d.totalScore) })} · {t('teams.games', { count: d.gamesPlayed })}
            </span>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section className="panel p-6">
          <h2 className="mb-4 text-xl font-bold">{t('teams.members')}</h2>
          <ul className="space-y-2">
            {d.members.map((m) => (
              <li key={m.pid} className="flex items-center gap-3 rounded-btn bg-line/[0.04] px-3 py-2.5">
                <span className="relative">
                  <Avatar avatar={m.avatar} color={m.color} size={38} />
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-bg-2 ${m.online ? 'bg-emerald-500' : 'bg-line/30'}`}
                    aria-label={m.online ? t('teams.online') : t('teams.offline')}
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{m.nickname}</span>
                  <span className="text-xs text-muted">{m.isOwner ? t('teams.owner') : t('teams.joinedAgo', { time: relativeTime(m.joinedAt) })}</span>
                </span>
                {isOwner && !m.isOwner ? (
                  <span className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (window.confirm(t('teams.confirmTransfer', { name: m.nickname }))) void act(() => api(`/teams/${id}/transfer`, { method: 'POST', body: { pid: m.pid } }), t('teams.transferred'));
                      }}
                    >
                      {t('teams.makeOwner')}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        if (window.confirm(t('teams.confirmKick', { name: m.nickname }))) void act(() => api(`/teams/${id}/kick`, { method: 'POST', body: { pid: m.pid } }), t('teams.kicked'));
                      }}
                    >
                      {t('teams.kick')}
                    </Button>
                  </span>
                ) : null}
              </li>
            ))}
            {Array.from({ length: Math.max(0, d.capacity - d.memberCount) }).map((_, i) => (
              <li key={`free-${i}`} className="flex items-center gap-3 rounded-btn border border-dashed border-line/15 px-3 py-2.5 text-sm font-semibold text-muted">
                <span className="grid h-[38px] w-[38px] place-items-center rounded-full border border-dashed border-line/25">+</span>
                {t('teams.freeSpot')}
              </li>
            ))}
          </ul>
        </section>

        <aside className="space-y-6">
          {d.inviteCode ? (
            <section className="panel p-6">
              <h2 className="mb-1 text-lg font-bold">{t('teams.inviteCode')}</h2>
              <p className="mb-4 text-sm text-muted">{t('teams.inviteCodeText')}</p>
              <button
                type="button"
                onClick={async () => {
                  if (await copyText(d.inviteCode!)) toast.success(t('common.copied'));
                }}
                className="flex w-full items-center justify-between rounded-btn border border-line/15 bg-surface-2/70 px-4 py-3 font-display text-xl font-black tracking-widest"
                aria-label={t('common.copy')}
              >
                {d.inviteCode} <IconCopy size={18} className="text-muted" />
              </button>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    if (await copyText(inviteLink)) toast.success(t('common.linkCopied'));
                  }}
                >
                  {t('teams.copyInviteLink')}
                </Button>
                {isOwner ? (
                  <Button size="sm" variant="ghost" onClick={() => act(() => api(`/teams/${id}/invite-code`, { method: 'POST' }), t('teams.codeRegenerated'))}>
                    {t('teams.regenerate')}
                  </Button>
                ) : null}
              </div>
            </section>
          ) : null}

          {isOwner ? (
            <section className="panel p-6">
              <h2 className="mb-4 text-lg font-bold">{t('teams.requests', { count: requests.data?.items.length ?? 0 })}</h2>
              {requests.data && requests.data.items.length ? (
                <ul className="space-y-2">
                  {requests.data.items.map((r) => (
                    <li key={r.id} className="flex items-center gap-3">
                      <Avatar avatar={r.avatar} color={r.color} size={32} />
                      <span className="flex-1 truncate font-bold">{r.nickname}</span>
                      <Button size="sm" onClick={() => act(() => api(`/teams/${id}/requests/${r.id}`, { method: 'POST', body: { action: 'accept' } }), t('teams.accepted'))}>
                        {t('teams.accept')}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => act(() => api(`/teams/${id}/requests/${r.id}`, { method: 'POST', body: { action: 'reject' } }))}>
                        {t('teams.reject')}
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">{t('teams.noRequests')}</p>
              )}
            </section>
          ) : null}

          <section className="panel p-6">
            <h2 className="mb-1 text-lg font-bold">{t('teams.playTogether')}</h2>
            <p className="mb-4 text-sm text-muted">{t('teams.playTogetherText')}</p>
            <ButtonLink to="/quizzes" variant="secondary" size="sm">
              {t('nav.quizzes')}
            </ButtonLink>
          </section>

          <button type="button" onClick={() => setReportOpen(true)} className="flex items-center gap-2 text-sm font-semibold text-muted hover:text-ink">
            <IconFlag size={16} /> {t('report.button')}
          </button>
        </aside>
      </div>
      <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} targetType="team" targetId={d.id} />
    </div>
  );
}

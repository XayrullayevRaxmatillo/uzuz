import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BADGES, levelProgress, type QuizCardDTO, type SessionDTO } from '@uzuz/shared';
import { api } from '../lib/api';
import { useAsync } from '../hooks/useAsync';
import { errorMessage } from '../lib/errors';
import { copyText } from '../lib/share';
import { formatDate, formatNumber } from '../i18n';
import { useSession } from '../context/SessionContext';
import { useToast } from '../context/ToastContext';
import { NicknameForm } from '../components/NicknameForm';
import { Avatar } from '../components/Avatar';
import { Badge, Button, EmptyState, Modal, PageLoader, Toggle } from '../components/ui';
import { IconCopy, IconEdit } from '../components/icons';

interface HistoryItem {
  roomCode: string;
  quizTitle: string;
  quizSlug: string | null;
  mode: string;
  finishedAt: string;
  playerCount: number;
  questionCount: number;
  score: number;
  rank: number;
  correct: number;
  xp: number;
}

const BADGE_ICONS: Record<string, string> = {
  first_game: '🎮',
  first_win: '🏆',
  streak_5: '🔥',
  perfect: '💯',
  games_10: '🎖️',
  team_player: '🤝',
  quiz_creator: '✍️'
};

export default function Me() {
  const { t } = useTranslation();
  const toast = useToast();
  const { session, update, saveProfile, setSession } = useSession();
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [restoreCode, setRestoreCode] = useState<string | null>(null);
  const [restoreInput, setRestoreInput] = useState('');
  const [restoring, setRestoring] = useState(false);
  const history = useAsync((signal) => api<{ items: HistoryItem[] }>('/session/history', { signal }), []);
  const mine = useAsync((signal) => api<{ items: (QuizCardDTO & { visibility: string; hidden: boolean })[] }>('/quizzes/mine', { signal }), []);

  if (!session) return <PageLoader />;
  const s = session.stats;
  const prog = levelProgress(s.xp);
  const accuracy = s.answered ? Math.round((s.correct / s.answered) * 100) : 0;

  return (
    <div className="container-page max-w-5xl py-10">
      <section className="panel flex flex-wrap items-center gap-6 p-6 sm:p-8">
        <Avatar avatar={session.avatar} color={session.color} size={96} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-3xl font-black">{session.nickname ?? t('me.noNickname')}</h1>
          <p className="mt-1 text-sm font-semibold text-muted">{t('me.guestSince', { date: formatDate(session.createdAt, { dateStyle: 'medium' }) })}</p>
          <div className="mt-4 max-w-md">
            <div className="mb-1.5 flex justify-between text-sm font-bold">
              <span>{t('game.level', { level: prog.level })}</span>
              <span className="text-muted">
                {formatNumber(s.xp)} / {formatNumber(prog.next)} XP
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-line/10" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(prog.ratio * 100)}>
              <div className="h-full rounded-full brand-gradient" style={{ width: `${Math.max(3, prog.ratio * 100)}%` }} />
            </div>
          </div>
        </div>
        <Button variant="secondary" onClick={() => setEditOpen(true)}>
          <IconEdit size={16} /> {t('me.editProfile')}
        </Button>
      </section>

      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [t('me.games'), formatNumber(s.games)],
          [t('me.wins'), formatNumber(s.wins)],
          [t('game.accuracy'), `${accuracy}%`],
          [t('game.bestStreak'), `🔥 ${s.bestStreak}`]
        ].map(([label, value]) => (
          <div key={label} className="panel p-5 text-center">
            <div className="font-display text-3xl font-black">{value}</div>
            <div className="mt-1 text-sm font-bold text-muted">{label}</div>
          </div>
        ))}
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-xl font-bold">{t('me.badges')}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {BADGES.map((b) => {
            const earned = s.badges.includes(b);
            return (
              <div key={b} className={`rounded-card border p-4 text-center transition ${earned ? 'border-amber-400/40 bg-amber-400/10' : 'border-line/10 opacity-50 grayscale'}`} title={t(`badges.${b}.desc`)}>
                <div className="text-3xl" aria-hidden="true">
                  {BADGE_ICONS[b]}
                </div>
                <div className="mt-2 text-sm font-bold">{t(`badges.${b}.name`)}</div>
                <div className="mt-0.5 text-xs text-muted">{t(`badges.${b}.desc`)}</div>
                <span className="sr-only">{earned ? t('me.earned') : t('me.locked')}</span>
              </div>
            );
          })}
        </div>
      </section>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <h2 className="mb-4 text-xl font-bold">{t('me.history')}</h2>
          {history.data && history.data.items.length ? (
            <ul className="space-y-2">
              {history.data.items.map((h) => (
                <li key={`${h.roomCode}-${h.finishedAt}`}>
                  <Link to={`/room/${h.roomCode}/results`} className="flex items-center gap-4 rounded-card border border-line/10 bg-surface/60 px-4 py-3 transition hover:border-line/30">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-line/5 font-display font-black">#{h.rank}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">{h.quizTitle}</span>
                      <span className="text-xs text-muted">
                        {formatDate(h.finishedAt)} · {t('me.correctOf', { n: h.correct, total: h.questionCount })} · {t('game.playersCount', { count: h.playerCount })}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block font-display font-extrabold">{formatNumber(h.score)}</span>
                      {h.xp ? <span className="text-xs font-bold text-violet-600 dark:text-violet-400">+{h.xp} XP</span> : null}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : history.loading ? (
            <PageLoader />
          ) : (
            <EmptyState title={t('me.noHistory')} action={<Link to="/quizzes" className="font-bold text-cyan-600 underline dark:text-cyan">{t('home.ctaPlay')}</Link>} />
          )}

          <h2 className="mb-4 mt-10 text-xl font-bold">{t('me.myQuizzes')}</h2>
          {mine.data && mine.data.items.length ? (
            <ul className="space-y-2">
              {mine.data.items.map((q) => (
                <li key={q.id} className="flex items-center gap-3 rounded-card border border-line/10 bg-surface/60 px-4 py-3">
                  <Link to={`/quizzes/${q.slug}`} className="min-w-0 flex-1 truncate font-bold hover:underline">
                    {q.title}
                  </Link>
                  {q.hidden ? <Badge tone="coral">{t('me.hiddenByModerator')}</Badge> : q.visibility === 'unlisted' ? <Badge tone="amber">{t('create.unlisted')}</Badge> : null}
                  <Link to={`/edit/${q.id}`} className="text-sm font-bold text-cyan-600 hover:underline dark:text-cyan">
                    {t('common.edit')}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title={t('me.noQuizzes')} action={<Link to="/create" className="font-bold text-cyan-600 underline dark:text-cyan">{t('home.ctaCreate')}</Link>} />
          )}
        </section>

        <aside className="space-y-6">
          <section className="panel space-y-5 p-6">
            <h2 className="text-lg font-bold">{t('me.privacy')}</h2>
            <Toggle
              checked={session.hideFromLeaderboard}
              onChange={async (v) => {
                try {
                  await update({ hideFromLeaderboard: v });
                  toast.success(t('me.saved'));
                } catch (err) {
                  toast.error(errorMessage(t, err));
                }
              }}
              label={t('me.hideFromLeaderboard')}
              description={t('me.hideFromLeaderboardHint')}
            />
          </section>

          <section className="panel space-y-4 p-6">
            <h2 className="text-lg font-bold">{t('me.restoreTitle')}</h2>
            <p className="text-sm text-muted">{t('me.guestNote')}</p>
            {restoreCode ? (
              <div className="rounded-card border border-amber-400/40 bg-amber-400/10 p-4">
                <p className="mb-2 text-sm font-semibold">{t('me.restoreCodeShown')}</p>
                <button
                  type="button"
                  onClick={async () => {
                    if (await copyText(restoreCode)) toast.success(t('common.copied'));
                  }}
                  className="flex w-full items-center justify-between rounded-btn bg-bg px-4 py-3 font-display text-lg font-black tracking-widest"
                >
                  {restoreCode} <IconCopy size={18} />
                </button>
              </div>
            ) : (
              <Button
                variant="secondary"
                onClick={async () => {
                  try {
                    const r = await api<{ code: string }>('/session/restore-code', { method: 'POST' });
                    setRestoreCode(r.code);
                  } catch (err) {
                    toast.error(errorMessage(t, err));
                  }
                }}
              >
                {t('me.createRestoreCode')}
              </Button>
            )}
            <form
              className="space-y-2 border-t border-line/10 pt-4"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!window.confirm(t('me.restoreConfirm'))) return;
                setRestoring(true);
                try {
                  const s2 = await api<SessionDTO>('/session/restore', { method: 'POST', body: { code: restoreInput } });
                  setSession(s2);
                  toast.success(t('me.restored'));
                  setRestoreInput('');
                  history.reload();
                  mine.reload();
                } catch (err) {
                  toast.error(errorMessage(t, err));
                } finally {
                  setRestoring(false);
                }
              }}
            >
              <label className="label" htmlFor="restore">
                {t('me.restoreHere')}
              </label>
              <div className="flex gap-2">
                <input id="restore" className="field font-display uppercase tracking-widest" placeholder="UZ-XXXX-XXXX" value={restoreInput} onChange={(e) => setRestoreInput(e.target.value)} maxLength={14} />
                <Button type="submit" loading={restoring} disabled={restoreInput.trim().length < 8}>
                  {t('me.restore')}
                </Button>
              </div>
            </form>
          </section>
        </aside>
      </div>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={t('me.editProfile')}>
        <NicknameForm
          submitLabel={t('common.save')}
          busy={saving}
          serverError={saveError}
          onSubmit={async (v) => {
            setSaving(true);
            setSaveError(null);
            try {
              await update(v);
              saveProfile(v);
              toast.success(t('me.saved'));
              setEditOpen(false);
            } catch (err) {
              setSaveError(errorMessage(t, err));
            } finally {
              setSaving(false);
            }
          }}
        />
      </Modal>
    </div>
  );
}

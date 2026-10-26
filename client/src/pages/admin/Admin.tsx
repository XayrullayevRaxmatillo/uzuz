import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { formatDate, formatNumber } from '../../i18n';
import { useToast } from '../../context/ToastContext';
import { Logo } from '../../components/Logo';
import { Badge, Button, PageLoader } from '../../components/ui';
import { LanguageSwitcher } from '../../components/Layout';

type Tab = 'dashboard' | 'quizzes' | 'reports' | 'categories' | 'teams' | 'audit';

/** Separate admin area. Server-side auth with its own httpOnly cookie; never linked publicly. */
export default function Admin() {
  const { t } = useTranslation();
  const [me, setMe] = useState<string | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>('dashboard');

  const check = useCallback(async () => {
    try {
      const r = await api<{ username: string }>('/admin/me');
      setMe(r.username);
    } catch {
      setMe(null);
    }
  }, []);

  useEffect(() => {
    void check();
    document.title = 'UZUZ Admin';
  }, [check]);

  if (me === undefined) return <PageLoader />;
  if (me === null) return <Login onDone={check} />;

  return (
    <div className="min-h-dvh bg-bg">
      <header className="border-b border-line/10 bg-bg-2">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
          <Link to="/">
            <Logo size={28} />
          </Link>
          <Badge tone="coral">{t('admin.badge')}</Badge>
          <nav className="flex flex-wrap gap-1">
            {(['dashboard', 'quizzes', 'reports', 'categories', 'teams', 'audit'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                aria-current={tab === k}
                className={`rounded-full px-3 py-1.5 text-sm font-bold ${tab === k ? 'bg-ink text-bg' : 'text-muted hover:text-ink'}`}
              >
                {t(`admin.tabs.${k}`)}
              </button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <LanguageSwitcher compact />
            <span className="text-sm font-semibold text-muted">{me}</span>
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                await api('/admin/logout', { method: 'POST' }).catch(() => undefined);
                setMe(null);
              }}
            >
              {t('admin.logout')}
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        {tab === 'dashboard' && <Dashboard />}
        {tab === 'quizzes' && <Quizzes />}
        {tab === 'reports' && <Reports />}
        {tab === 'categories' && <Categories />}
        {tab === 'teams' && <Teams />}
        {tab === 'audit' && <Audit />}
      </main>
    </div>
  );
}

function Login({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/admin/login', { method: 'POST', body: { username, password } });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError && err.code === 'ADMIN_AUTH' ? t('admin.badLogin') : errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="grid min-h-dvh place-items-center bg-bg px-4">
      <form onSubmit={submit} className="panel w-full max-w-sm space-y-4 p-6">
        <Logo />
        <h1 className="text-xl font-bold">{t('admin.loginTitle')}</h1>
        <div>
          <label className="label" htmlFor="adm-u">
            {t('admin.username')}
          </label>
          <input id="adm-u" className="field" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="adm-p">
            {t('admin.password')}
          </label>
          <input id="adm-p" type="password" className="field" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error ? (
          <p className="text-sm font-semibold text-coral" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="w-full" loading={busy}>
          {t('admin.login')}
        </Button>
        <p className="text-xs text-muted">{t('admin.loginHint')}</p>
      </form>
    </div>
  );
}

function useAdminData<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    api<T>(path)
      .then((d) => alive && setData(d))
      .catch(() => alive && setData(null));
    return () => {
      alive = false;
    };
  }, [path, tick]);
  return { data, reload: () => setTick((n) => n + 1) };
}

function useAction() {
  const { t } = useTranslation();
  const toast = useToast();
  return async (fn: () => Promise<unknown>, after?: () => void) => {
    try {
      await fn();
      toast.success(t('admin.done'));
      after?.();
    } catch (err) {
      toast.error(errorMessage(t, err));
    }
  };
}

function Dashboard() {
  const { t } = useTranslation();
  const { data } = useAdminData<{
    quizzes: number;
    hiddenQuizzes: number;
    teams: number;
    sessions: number;
    gamesToday: number;
    gamesTotal: number;
    openReports: number;
    live: { rooms: number; playing: number; players: number };
  }>('/admin/stats');
  if (!data) return <PageLoader />;
  const tiles: [string, number][] = [
    [t('admin.stats.liveRooms'), data.live.rooms],
    [t('admin.stats.playing'), data.live.playing],
    [t('admin.stats.livePlayers'), data.live.players],
    [t('admin.stats.gamesToday'), data.gamesToday],
    [t('admin.stats.gamesTotal'), data.gamesTotal],
    [t('admin.stats.quizzes'), data.quizzes],
    [t('admin.stats.hiddenQuizzes'), data.hiddenQuizzes],
    [t('admin.stats.teams'), data.teams],
    [t('admin.stats.sessions'), data.sessions],
    [t('admin.stats.openReports'), data.openReports]
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {tiles.map(([label, value]) => (
        <div key={label} className="panel p-5">
          <div className="font-display text-3xl font-black">{formatNumber(value)}</div>
          <div className="mt-1 text-sm font-semibold text-muted">{label}</div>
        </div>
      ))}
    </div>
  );
}

interface AdminQuiz {
  id: string;
  slug: string;
  title: string;
  authorName: string;
  isOfficial: boolean;
  hidden: boolean;
  featured: boolean;
  reportsCount: number;
  plays: number;
  createdAt: string;
}

function Quizzes() {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const { data, reload } = useAdminData<{ items: AdminQuiz[] }>(`/admin/quizzes?q=${encodeURIComponent(q)}&status=${status}`);
  const act = useAction();
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <input className="field max-w-xs" placeholder={t('admin.search')} value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="field max-w-[200px]" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t('admin.all')}</option>
          <option value="reported">{t('admin.reported')}</option>
          <option value="hidden">{t('admin.hidden')}</option>
        </select>
      </div>
      <div className="overflow-x-auto rounded-card border border-line/10">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-line/5 text-muted">
            <tr>
              <th className="p-3">{t('admin.quizTitle')}</th>
              <th className="p-3">{t('admin.author')}</th>
              <th className="p-3">{t('admin.plays')}</th>
              <th className="p-3">{t('admin.reports')}</th>
              <th className="p-3">{t('admin.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((qz) => (
              <tr key={qz.id} className="border-t border-line/10">
                <td className="p-3 font-semibold">
                  <Link to={`/quizzes/${qz.slug}`} className="hover:underline" target="_blank">
                    {qz.title}
                  </Link>
                  {qz.hidden ? <Badge tone="coral" className="ml-2">{t('admin.hidden')}</Badge> : null}
                  {qz.featured ? <Badge tone="violet" className="ml-2">{t('admin.featured')}</Badge> : null}
                </td>
                <td className="p-3">{qz.isOfficial ? 'UZUZ' : qz.authorName}</td>
                <td className="p-3">{qz.plays}</td>
                <td className="p-3">{qz.reportsCount}</td>
                <td className="flex flex-wrap gap-1 p-3">
                  <Button size="sm" variant="secondary" onClick={() => act(() => api(`/admin/quizzes/${qz.id}`, { method: 'PATCH', body: { hidden: !qz.hidden } }), reload)}>
                    {qz.hidden ? t('admin.unhide') : t('admin.hide')}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => act(() => api(`/admin/quizzes/${qz.id}`, { method: 'PATCH', body: { featured: !qz.featured } }), reload)}>
                    {qz.featured ? t('admin.unfeature') : t('admin.feature')}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      if (window.confirm(t('admin.confirmDelete'))) void act(() => api(`/admin/quizzes/${qz.id}`, { method: 'DELETE' }), reload);
                    }}
                  >
                    {t('common.delete')}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface AdminReport {
  id: string;
  targetType: string;
  targetId: string;
  targetLabel: string;
  reason: string;
  details: string;
  status: string;
  createdAt: string;
}

function Reports() {
  const { t } = useTranslation();
  const [status, setStatus] = useState('open');
  const { data, reload } = useAdminData<{ items: AdminReport[] }>(`/admin/reports?status=${status}`);
  const act = useAction();
  return (
    <div>
      <div className="mb-4 flex gap-1">
        {['open', 'resolved', 'dismissed'].map((s) => (
          <button key={s} type="button" onClick={() => setStatus(s)} className={`rounded-full px-3 py-1.5 text-sm font-bold ${status === s ? 'bg-ink text-bg' : 'text-muted'}`}>
            {t(`admin.reportStatus.${s}`)}
          </button>
        ))}
      </div>
      {data && data.items.length === 0 ? <p className="text-muted">{t('admin.noReports')}</p> : null}
      <ul className="space-y-3">
        {data?.items.map((r) => (
          <li key={r.id} className="panel p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{r.targetType}</Badge>
              <span className="font-bold">{r.targetLabel}</span>
              <Badge tone="amber">{t(`report.reasons.${r.reason}`)}</Badge>
              <span className="ml-auto text-xs text-muted">{formatDate(r.createdAt)}</span>
            </div>
            {r.details ? <p className="mt-2 text-sm text-muted">{r.details}</p> : null}
            {r.status === 'open' ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="danger" onClick={() => act(() => api(`/admin/reports/${r.id}`, { method: 'PATCH', body: { status: 'resolved', hideTarget: true } }), reload)}>
                  {t('admin.hideAndResolve')}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => act(() => api(`/admin/reports/${r.id}`, { method: 'PATCH', body: { status: 'resolved' } }), reload)}>
                  {t('admin.resolve')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => act(() => api(`/admin/reports/${r.id}`, { method: 'PATCH', body: { status: 'dismissed' } }), reload)}>
                  {t('admin.dismiss')}
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

interface AdminCategory {
  slug: string;
  name: { uz: string; ru: string; en: string };
  icon: string;
  color: string;
  order: number;
}

function Categories() {
  const { t } = useTranslation();
  const { data, reload } = useAdminData<{ items: AdminCategory[] }>('/admin/categories');
  const act = useAction();
  const [edits, setEdits] = useState<Record<string, AdminCategory>>({});
  if (!data) return <PageLoader />;
  return (
    <div className="space-y-3">
      {data.items.map((c) => {
        const e = edits[c.slug] ?? c;
        const set = (patch: Partial<AdminCategory>) => setEdits({ ...edits, [c.slug]: { ...e, ...patch } });
        return (
          <div key={c.slug} className="panel grid gap-2 p-4 sm:grid-cols-[60px_1fr_1fr_1fr_80px_100px_auto] sm:items-center">
            <input className="field text-center" value={e.icon} onChange={(ev) => set({ icon: ev.target.value })} aria-label="icon" />
            <input className="field" value={e.name.uz} onChange={(ev) => set({ name: { ...e.name, uz: ev.target.value } })} aria-label="UZ" />
            <input className="field" value={e.name.ru} onChange={(ev) => set({ name: { ...e.name, ru: ev.target.value } })} aria-label="RU" />
            <input className="field" value={e.name.en} onChange={(ev) => set({ name: { ...e.name, en: ev.target.value } })} aria-label="EN" />
            <input className="field" type="number" value={e.order} onChange={(ev) => set({ order: Number(ev.target.value) })} aria-label="order" />
            <input className="h-11 w-full rounded-btn" type="color" value={e.color} onChange={(ev) => set({ color: ev.target.value })} aria-label="color" />
            <Button size="sm" onClick={() => act(() => api(`/admin/categories/${c.slug}`, { method: 'PUT', body: { name: e.name, icon: e.icon, color: e.color, order: e.order } }), reload)}>
              {t('common.save')}
            </Button>
          </div>
        );
      })}
    </div>
  );
}

interface AdminTeam {
  id: string;
  name: string;
  emoji: string;
  visibility: string;
  memberCount: number;
  capacity: number;
  hiddenByAdmin: boolean;
  totalScore: number;
}

function Teams() {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const { data, reload } = useAdminData<{ items: AdminTeam[] }>(`/admin/teams?q=${encodeURIComponent(q)}`);
  const act = useAction();
  return (
    <div>
      <input className="field mb-4 max-w-xs" placeholder={t('admin.search')} value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className="space-y-2">
        {data?.items.map((tm) => (
          <li key={tm.id} className="panel flex flex-wrap items-center gap-3 p-3">
            <span className="text-xl">{tm.emoji}</span>
            <Link to={`/teams/${tm.id}`} className="font-bold hover:underline" target="_blank">
              {tm.name}
            </Link>
            <Badge>{tm.visibility}</Badge>
            <span className="text-sm text-muted">
              {tm.memberCount}/{tm.capacity}
            </span>
            {tm.hiddenByAdmin ? <Badge tone="coral">{t('admin.hidden')}</Badge> : null}
            <span className="ml-auto flex gap-1">
              <Button size="sm" variant="secondary" onClick={() => act(() => api(`/admin/teams/${tm.id}`, { method: 'PATCH', body: { hiddenByAdmin: !tm.hiddenByAdmin } }), reload)}>
                {tm.hiddenByAdmin ? t('admin.unhide') : t('admin.hide')}
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  if (window.confirm(t('admin.confirmArchive'))) void act(() => api(`/admin/teams/${tm.id}`, { method: 'PATCH', body: { archived: true } }), reload);
                }}
              >
                {t('admin.archive')}
              </Button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Audit() {
  const { t } = useTranslation();
  const { data } = useAdminData<{ items: { _id: string; adminName: string; action: string; targetType: string; targetId: string; createdAt: string }[] }>('/admin/audit');
  if (!data) return <PageLoader />;
  if (!data.items.length) return <p className="text-muted">{t('admin.noAudit')}</p>;
  return (
    <ul className="space-y-1.5 text-sm">
      {data.items.map((a) => (
        <li key={a._id} className="flex flex-wrap gap-3 rounded-btn bg-line/[0.04] px-3 py-2">
          <span className="text-muted">{formatDate(a.createdAt)}</span>
          <span className="font-bold">{a.adminName}</span>
          <span className="font-mono">{a.action}</span>
          <span className="text-muted">
            {a.targetType}:{a.targetId}
          </span>
        </li>
      ))}
    </ul>
  );
}

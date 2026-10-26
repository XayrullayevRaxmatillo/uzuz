import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  CATEGORY_SLUGS,
  LANGS,
  SKILL_LEVELS,
  TEAM_CAPACITY_MAX,
  TEAM_CAPACITY_MIN,
  teamInputSchema,
  type CategorySlug,
  type Lang,
  type SkillLevel,
  type TeamCardDTO,
  type TeamJoinPolicy
} from '@uzuz/shared';
import { api, qs } from '../lib/api';
import { useAsync } from '../hooks/useAsync';
import { errorMessage } from '../lib/errors';
import { absoluteUrl, shareLink } from '../lib/share';
import { KEYS, storage } from '../lib/storage';
import { currentLang } from '../i18n';
import { useToast } from '../context/ToastContext';
import { TeamCard } from '../components/TeamCard';
import { Button, EmptyState, ErrorState, Field, Modal, Select, Skeleton, Toggle } from '../components/ui';
import { IconPlus, IconSearch, IconSparkles } from '../components/icons';

interface MatchResult {
  team: TeamCardDTO;
  score: number;
  reasons: string[];
}

const EMOJIS = ['⚡', '🚀', '🦅', '🔥', '🧠', '🎯', '🌟', '🐆', '🏆', '🌙', '💎', '🛡️'];

export default function Teams() {
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [subject, setSubject] = useState('');
  const [language, setLanguage] = useState('');
  const [level, setLevel] = useState('');
  const [hasSpace, setHasSpace] = useState(true);
  const [sort, setSort] = useState<'active' | 'new'>('active');
  const [createOpen, setCreateOpen] = useState(params.get('create') === '1');
  const [code, setCode] = useState('');
  const [codeBusy, setCodeBusy] = useState(false);
  const [matchPrefs, setMatchPrefs] = useState(() =>
    storage.get<{ subject: string; language: string; level: string }>(KEYS.teamPrefs, { subject: '', language: currentLang(), level: 'beginner' })
  );
  const [matches, setMatches] = useState<MatchResult[] | null>(null);
  const [matching, setMatching] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => window.clearTimeout(id);
  }, [q]);

  const list = useAsync(
    (signal) => api<{ items: TeamCardDTO[]; total: number }>(`/teams${qs({ q: debouncedQ, subject, language, level, hasSpace, sort, limit: 24 })}`, { signal }),
    [debouncedQ, subject, language, level, hasSpace, sort]
  );
  const mine = useAsync((signal) => api<{ items: (TeamCardDTO & { isOwner: boolean })[] }>('/teams/mine', { signal }), []);

  const runMatch = async () => {
    setMatching(true);
    storage.set(KEYS.teamPrefs, matchPrefs);
    try {
      const r = await api<{ items: MatchResult[] }>(`/teams/match${qs(matchPrefs)}`);
      setMatches(r.items);
    } catch (err) {
      toast.error(errorMessage(t, err));
    } finally {
      setMatching(false);
    }
  };

  const joinByCode = async (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setCodeBusy(true);
    try {
      const r = await api<{ id: string }>('/teams/join-by-code', { method: 'POST', body: { code: code.trim() } });
      toast.success(t('teams.joined'));
      navigate(`/teams/${r.id}`);
    } catch (err) {
      toast.error(errorMessage(t, err));
    } finally {
      setCodeBusy(false);
    }
  };

  const inviteFriends = async () => {
    const r = await shareLink({ title: 'UZUZ', text: t('teams.inviteText'), url: absoluteUrl('/teams') });
    if (r === 'copied') toast.success(t('common.linkCopied'));
  };

  const closeCreate = () => {
    setCreateOpen(false);
    if (params.get('create')) {
      params.delete('create');
      setParams(params, { replace: true });
    }
  };

  return (
    <div className="container-page py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black sm:text-4xl">{t('teams.title')}</h1>
          <p className="mt-1 text-muted">{t('teams.subtitle')}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <IconPlus size={18} /> {t('teams.create')}
        </Button>
      </div>

      <div className="mb-10 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* Quick match */}
        <section className="panel p-5 sm:p-6">
          <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
            <IconSparkles size={20} className="text-cyan" /> {t('teams.matchTitle')}
          </h2>
          <p className="mb-4 text-sm text-muted">{t('teams.matchText')}</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Select value={matchPrefs.subject} onChange={(e) => setMatchPrefs({ ...matchPrefs, subject: e.target.value })} aria-label={t('teams.subject')}>
              <option value="">{t('teams.anySubject')}</option>
              {CATEGORY_SLUGS.map((c) => (
                <option key={c} value={c}>
                  {t(`categories.${c}`)}
                </option>
              ))}
            </Select>
            <Select value={matchPrefs.language} onChange={(e) => setMatchPrefs({ ...matchPrefs, language: e.target.value })} aria-label={t('teams.language')}>
              {LANGS.map((l) => (
                <option key={l} value={l}>
                  {t(`languages.${l}`)}
                </option>
              ))}
            </Select>
            <Select value={matchPrefs.level} onChange={(e) => setMatchPrefs({ ...matchPrefs, level: e.target.value })} aria-label={t('teams.level')}>
              {SKILL_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {t(`levels.${l}`)}
                </option>
              ))}
            </Select>
            <Button variant="cyan" onClick={runMatch} loading={matching} className="sm:col-span-3">
              {t('teams.findMatch')}
            </Button>
          </div>
        </section>

        {/* Join by code */}
        <section className="panel p-5 sm:p-6">
          <h2 className="mb-1 text-lg font-bold">{t('teams.joinByCode')}</h2>
          <p className="mb-4 text-sm text-muted">{t('teams.joinByCodeText')}</p>
          <form onSubmit={joinByCode} className="flex gap-2">
            <input className="field font-display font-bold uppercase tracking-widest" placeholder="T-XXXXXX" value={code} onChange={(e) => setCode(e.target.value)} maxLength={12} aria-label={t('teams.inviteCode')} />
            <Button type="submit" loading={codeBusy} disabled={!code.trim()}>
              {t('teams.join')}
            </Button>
          </form>
        </section>
      </div>

      {matches ? (
        <section className="mb-12" aria-live="polite">
          <h2 className="mb-4 text-xl font-bold">{t('teams.matchResults')}</h2>
          {matches.length ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {matches.map((m) => (
                <TeamCard key={m.team.id} team={m.team} reasons={m.reasons} />
              ))}
            </div>
          ) : (
            <EmptyState
              title={t('teams.noMatchTitle')}
              text={t('teams.noMatchText')}
              action={
                <>
                  <Button onClick={() => setCreateOpen(true)}>{t('teams.create')}</Button>
                  <Button variant="secondary" onClick={inviteFriends}>
                    {t('teams.invite')}
                  </Button>
                </>
              }
            />
          )}
        </section>
      ) : null}

      {mine.data && mine.data.items.length ? (
        <section className="mb-12">
          <h2 className="mb-4 text-xl font-bold">{t('teams.mine')}</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {mine.data.items.map((tm) => (
              <TeamCard key={tm.id} team={tm} />
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="mb-4 text-xl font-bold">{t('teams.browse')}</h2>
        <div className="panel mb-5 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6">
          <div className="relative sm:col-span-2">
            <IconSearch size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
            <input type="search" className="field pl-11" placeholder={t('teams.search')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('teams.search')} />
          </div>
          <Select value={subject} onChange={(e) => setSubject(e.target.value)} aria-label={t('teams.subject')}>
            <option value="">{t('teams.anySubject')}</option>
            {CATEGORY_SLUGS.map((c) => (
              <option key={c} value={c}>
                {t(`categories.${c}`)}
              </option>
            ))}
          </Select>
          <Select value={language} onChange={(e) => setLanguage(e.target.value)} aria-label={t('teams.language')}>
            <option value="">{t('quizzes.anyLanguage')}</option>
            {LANGS.map((l) => (
              <option key={l} value={l}>
                {t(`languages.${l}`)}
              </option>
            ))}
          </Select>
          <Select value={level} onChange={(e) => setLevel(e.target.value)} aria-label={t('teams.level')}>
            <option value="">{t('teams.anyLevel')}</option>
            {SKILL_LEVELS.map((l) => (
              <option key={l} value={l}>
                {t(`levels.${l}`)}
              </option>
            ))}
          </Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value as 'active' | 'new')} aria-label={t('quizzes.sort')}>
            <option value="active">{t('teams.sortActive')}</option>
            <option value="new">{t('teams.sortNew')}</option>
          </Select>
          <div className="sm:col-span-2 lg:col-span-6">
            <Toggle checked={hasSpace} onChange={setHasSpace} label={t('teams.hasSpace')} />
          </div>
        </div>

        {list.loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-60" />
            ))}
          </div>
        ) : list.error ? (
          <ErrorState message={errorMessage(t, list.error)} onRetry={list.reload} />
        ) : list.data && list.data.items.length ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {list.data.items.map((tm) => (
              <TeamCard key={tm.id} team={tm} />
            ))}
          </div>
        ) : (
          <EmptyState
            title={t('teams.emptyTitle')}
            text={t('teams.emptyText')}
            action={
              <>
                <Button onClick={() => setCreateOpen(true)}>{t('teams.create')}</Button>
                <Button variant="secondary" onClick={inviteFriends}>
                  {t('teams.invite')}
                </Button>
              </>
            }
          />
        )}
      </section>

      <CreateTeamModal open={createOpen} onClose={closeCreate} onCreated={(id) => navigate(`/teams/${id}`)} />
    </div>
  );
}

function CreateTeamModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [emoji, setEmoji] = useState('⚡');
  const [subject, setSubject] = useState<CategorySlug>('general');
  const [language, setLanguage] = useState<Lang>(currentLang());
  const [level, setLevel] = useState<SkillLevel>('beginner');
  const [capacity, setCapacity] = useState(5);
  const [isPrivate, setIsPrivate] = useState(false);
  const [joinPolicy, setJoinPolicy] = useState<TeamJoinPolicy>('open');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const body = {
      name,
      description,
      emoji,
      subject,
      language,
      level,
      capacity,
      visibility: isPrivate ? 'private' : 'public',
      joinPolicy: isPrivate && joinPolicy === 'open' ? 'invite' : joinPolicy
    };
    const parsed = teamInputSchema.safeParse(body);
    if (!parsed.success) {
      setError(parsed.error.issues.some((i) => i.message === 'profanity') ? t('create.issueProfanity') : t('teams.nameInvalid'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ id: string }>('/teams', { method: 'POST', body: parsed.data });
      toast.success(t('teams.created'));
      onClose();
      onCreated(r.id);
    } catch (err) {
      setError(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t('teams.createTitle')}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <p className="label">{t('teams.emoji')}</p>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t('teams.emoji')}>
            {EMOJIS.map((em) => (
              <button
                key={em}
                type="button"
                role="radio"
                aria-checked={emoji === em}
                onClick={() => setEmoji(em)}
                className={`grid h-10 w-10 place-items-center rounded-xl text-xl transition ${emoji === em ? 'bg-cyan/20 ring-2 ring-cyan' : 'bg-line/5 hover:bg-line/10'}`}
              >
                {em}
              </button>
            ))}
          </div>
        </div>
        <Field label={t('teams.name')} htmlFor="team-name" error={error}>
          <input id="team-name" className="field font-bold" maxLength={30} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('teams.namePlaceholder')} />
        </Field>
        <Field label={t('teams.description')} htmlFor="team-desc">
          <textarea id="team-desc" className="field min-h-[70px]" maxLength={200} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Select label={t('teams.subject')} value={subject} onChange={(e) => setSubject(e.target.value as CategorySlug)}>
            {CATEGORY_SLUGS.map((c) => (
              <option key={c} value={c}>
                {t(`categories.${c}`)}
              </option>
            ))}
          </Select>
          <Select label={t('teams.language')} value={language} onChange={(e) => setLanguage(e.target.value as Lang)}>
            {LANGS.map((l) => (
              <option key={l} value={l}>
                {t(`languages.${l}`)}
              </option>
            ))}
          </Select>
          <Select label={t('teams.level')} value={level} onChange={(e) => setLevel(e.target.value as SkillLevel)}>
            {SKILL_LEVELS.map((l) => (
              <option key={l} value={l}>
                {t(`levels.${l}`)}
              </option>
            ))}
          </Select>
          <Select label={t('teams.capacity')} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))}>
            {Array.from({ length: TEAM_CAPACITY_MAX - TEAM_CAPACITY_MIN + 1 }, (_, i) => i + TEAM_CAPACITY_MIN).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </div>
        <Toggle checked={isPrivate} onChange={setIsPrivate} label={t('teams.privateTeam')} description={t('teams.privateHint')} />
        <Select label={t('teams.joinPolicy')} value={isPrivate && joinPolicy === 'open' ? 'invite' : joinPolicy} onChange={(e) => setJoinPolicy(e.target.value as TeamJoinPolicy)}>
          {!isPrivate ? <option value="open">{t('teams.policy.open')}</option> : null}
          <option value="approval">{t('teams.policy.approval')}</option>
          <option value="invite">{t('teams.policy.invite')}</option>
        </Select>
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          {t('teams.createButton')}
        </Button>
      </form>
    </Modal>
  );
}

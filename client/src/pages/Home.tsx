import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { ROOM_CODE_LENGTH, type QuizCardDTO, type TeamCardDTO } from '@uzuz/shared';
import { api } from '../lib/api';
import { useAsync } from '../hooks/useAsync';
import { useCategories } from '../lib/categories';
import { CodeInput } from '../components/CodeInput';
import { QuizCard } from '../components/QuizCard';
import { TeamCard } from '../components/TeamCard';
import { Button, ButtonLink, EmptyState, ErrorState, SectionHeader, Skeleton } from '../components/ui';
import { AnswerShape } from '../components/Shape';
import { errorMessage } from '../lib/errors';
import { formatNumber } from '../i18n';
import { IconPlay, IconPlus, IconUsers } from '../components/icons';

/** Interactive sample question in the hero — a 5-second taste of the game, no account needed. */
function HeroDemo() {
  const { t } = useTranslation();
  const [picked, setPicked] = useState<number | null>(null);
  const options = t('home.demo.options', { returnObjects: true }) as string[];
  const correct = 1;
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, rotate: 2 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ delay: 0.15, type: 'spring', stiffness: 120, damping: 16 }}
      className="relative mx-auto w-full max-w-md"
    >
      <div className="absolute inset-0 -z-10 rounded-[40px] sm:-inset-6 bg-gradient-to-br from-violet/40 via-indigo/20 to-cyan/20 blur-2xl" aria-hidden="true" />
      <div className="rounded-panel border border-white/10 bg-navy-900/90 p-5 text-white shadow-lift sm:p-6">
        <div className="mb-4 flex items-center justify-between text-sm font-bold text-white/70">
          <span>{t('home.demo.label')}</span>
          <span className="rounded-full bg-white/10 px-2.5 py-1">20s</span>
        </div>
        <p className="mb-5 font-display text-xl font-bold leading-snug">{t('home.demo.question')}</p>
        <div className="grid grid-cols-2 gap-2.5">
          {options.map((o, i) => {
            const revealed = picked !== null;
            const isCorrect = i === correct;
            return (
              <motion.button
                key={o}
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={() => setPicked(i)}
                disabled={revealed}
                animate={{ opacity: revealed && !isCorrect && picked !== i ? 0.35 : 1 }}
                className="flex min-h-[64px] items-center gap-2.5 rounded-2xl p-3 text-left text-sm font-bold text-white disabled:cursor-default"
                style={{ background: ['#FF6B6B', '#4F7BFF', '#F5B731', '#1FBF8F'][i] }}
                aria-pressed={picked === i}
              >
                <AnswerShape index={i} size={20} color="#fff" />
                <span className="leading-tight">{o}</span>
              </motion.button>
            );
          })}
        </div>
        <div className="mt-4 min-h-[24px] text-sm font-semibold" aria-live="polite">
          {picked === null ? (
            <span className="text-white/60">{t('home.demo.hint')}</span>
          ) : picked === correct ? (
            <span className="text-emerald-300">{t('home.demo.correct')}</span>
          ) : (
            <span className="text-coral-400">{t('home.demo.wrong', { answer: options[correct] })}</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function Home() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const categories = useCategories();
  const popular = useAsync((signal) => api<{ items: QuizCardDTO[] }>('/quizzes?limit=6', { signal }), []);
  const teams = useAsync((signal) => api<{ items: TeamCardDTO[] }>('/teams?limit=3&hasSpace=1', { signal }), []);

  const join = async (value = code) => {
    if (value.length !== ROOM_CODE_LENGTH) return;
    setChecking(true);
    setCodeError(null);
    try {
      const info = await api<{ isHost: boolean; mode: string }>(`/rooms/${value}`);
      navigate(info.isHost && info.mode !== 'solo' ? `/room/${value}/host` : `/room/${value}/play`);
    } catch (err) {
      setCodeError(errorMessage(t, err));
    } finally {
      setChecking(false);
    }
  };

  return (
    <div>
      {/* ---------- Hero ---------- */}
      <section className="container-page grid items-center gap-12 pb-16 pt-10 sm:pt-16 lg:grid-cols-[1.15fr_1fr] lg:gap-16 lg:pb-24">
        <div>
          <h1 className="font-display text-[2.6rem] font-black leading-[1.02] tracking-tight sm:text-6xl lg:text-[4.4rem]">
            <span className="block">{t('home.heroLine1')}</span>
            <span className="block text-gradient">{t('home.heroLine2')}</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted">{t('home.heroText')}</p>

          <form
            className="mt-8 max-w-xl rounded-panel border border-line/10 bg-surface/60 p-4 backdrop-blur sm:p-5"
            onSubmit={(e) => {
              e.preventDefault();
              void join();
            }}
          >
            <label className="mb-3 block text-sm font-bold text-muted">{t('home.codeLabel')}</label>
            <div className="flex flex-col items-center gap-3 sm:flex-row">
              <CodeInput value={code} onChange={(v) => { setCode(v); setCodeError(null); }} onComplete={(v) => void join(v)} size="md" invalid={!!codeError} />
              <Button type="submit" variant="cyan" size="lg" loading={checking} disabled={code.length !== ROOM_CODE_LENGTH} className="w-full sm:w-auto">
                {t('home.ctaCode')}
              </Button>
            </div>
            {codeError ? (
              <p className="mt-2 text-sm font-semibold text-coral" role="alert">
                {codeError}
              </p>
            ) : null}
          </form>

          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink to="/quizzes" size="lg">
              <IconPlay size={18} /> {t('home.ctaPlay')}
            </ButtonLink>
            <ButtonLink to="/teams" size="lg" variant="secondary">
              <IconUsers size={18} /> {t('home.ctaTeams')}
            </ButtonLink>
            <ButtonLink to="/create" size="lg" variant="secondary">
              <IconPlus size={18} /> {t('home.ctaCreate')}
            </ButtonLink>
          </div>
          <p className="mt-5 text-sm font-semibold text-muted">{t('home.noAccount')}</p>
        </div>
        <HeroDemo />
      </section>

      {/* ---------- Categories ---------- */}
      <section className="container-page pb-14">
        <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0">
          {(categories ?? []).map((c) => (
            <Link
              key={c.slug}
              to={`/quizzes?category=${c.slug}`}
              className="flex shrink-0 items-center gap-3 rounded-full border border-line/10 bg-surface/60 py-2 pl-2 pr-4 font-bold transition hover:border-line/30"
            >
              <span className="grid h-9 w-9 place-items-center rounded-full text-lg" style={{ background: `${c.color}30` }} aria-hidden="true">
                {c.icon}
              </span>
              {t(`categories.${c.slug}`)}
              <span className="text-sm font-semibold text-muted">{formatNumber(c.quizCount)}</span>
            </Link>
          ))}
          {!categories && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[52px] w-40 shrink-0 !rounded-full" />)}
        </div>
      </section>

      {/* ---------- Popular ---------- */}
      <section className="container-page pb-16">
        <SectionHeader
          title={t('home.popular')}
          action={
            <Link to="/quizzes" className="text-sm font-bold text-cyan-600 hover:underline dark:text-cyan">
              {t('common.seeAll')}
            </Link>
          }
        />
        {popular.loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
        ) : popular.error ? (
          <ErrorState message={errorMessage(t, popular.error)} onRetry={popular.reload} />
        ) : popular.data?.items.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {popular.data.items.map((q) => (
              <QuizCard key={q.id} quiz={q} />
            ))}
          </div>
        ) : (
          <EmptyState title={t('quizzes.empty')} action={<ButtonLink to="/create">{t('home.ctaCreate')}</ButtonLink>} />
        )}
      </section>

      {/* ---------- How it works (a real sequence) ---------- */}
      <section className="container-page pb-16">
        <div className="panel grid gap-8 p-6 sm:p-10 md:grid-cols-3">
          {(['step1', 'step2', 'step3'] as const).map((s, i) => (
            <div key={s} className="flex gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl" style={{ background: ['#FF6B6B', '#4F7BFF', '#F5B731'][i] }}>
                <AnswerShape index={i} size={20} color="#fff" />
              </span>
              <div>
                <h3 className="font-display text-lg font-bold">
                  {i + 1}. {t(`home.${s}Title`)}
                </h3>
                <p className="mt-1 text-muted">{t(`home.${s}Text`)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Teams ---------- */}
      <section className="container-page pb-10">
        <SectionHeader
          title={t('home.teams')}
          action={
            <Link to="/teams" className="text-sm font-bold text-cyan-600 hover:underline dark:text-cyan">
              {t('common.seeAll')}
            </Link>
          }
        />
        {teams.loading ? (
          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-56" />
            ))}
          </div>
        ) : teams.data?.items.length ? (
          <div className="grid gap-4 md:grid-cols-3">
            {teams.data.items.map((tm) => (
              <TeamCard key={tm.id} team={tm} />
            ))}
          </div>
        ) : (
          <EmptyState
            title={t('teams.emptyTitle')}
            text={t('teams.emptyText')}
            action={
              <>
                <ButtonLink to="/teams?create=1">{t('teams.create')}</ButtonLink>
                <ButtonLink to="/teams" variant="secondary">
                  {t('teams.invite')}
                </ButtonLink>
              </>
            }
          />
        )}
      </section>
    </div>
  );
}

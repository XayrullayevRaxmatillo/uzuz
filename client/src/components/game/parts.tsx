import type { TFunction } from 'i18next';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import { ANSWER_STYLES, COLOR_TEAMS, type LeaderboardEntry, type PublicPlayer, type TeamOption, type TeamStanding } from '@uzuz/shared';
import { Avatar } from '../Avatar';
import { AnswerShape } from '../Shape';
import { CountUp } from './visuals';
import { assetUrl } from '../../lib/api';
import { IconCheck, IconX } from '../icons';

export function teamLabel(t: TFunction, team: { key: string; name: string }): string {
  if (team.name) return team.name;
  const color = team.key.split(':')[1];
  return t(`game.colorTeams.${color}`);
}

export function teamColor(key: string | null, teams: TeamOption[]): string {
  if (!key) return '#8892B0';
  return teams.find((x) => x.key === key)?.color ?? COLOR_TEAMS.find((c) => c.key === key)?.color ?? '#8B5CF6';
}

/* ---------------- Answer tiles ---------------- */

export function AnswerGrid({
  options,
  onPick,
  picked,
  correct,
  disabled,
  big = false,
  distribution
}: {
  options: { text: string }[];
  onPick?: (i: number) => void;
  picked?: number | null;
  correct?: number | null;
  disabled?: boolean;
  big?: boolean;
  distribution?: number[];
}) {
  const { t } = useTranslation();

  // Keyboard play: keys 1–4 pick an answer.
  useEffect(() => {
    if (!onPick || disabled) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const n = Number.parseInt(e.key, 10);
      if (n >= 1 && n <= options.length) onPick(n - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onPick, disabled, options.length]);

  const total = distribution?.reduce((a, b) => a + b, 0) ?? 0;
  const revealed = correct !== null && correct !== undefined;

  return (
    <div className={`grid gap-3 ${options.length === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'}`} role="group" aria-label={t('game.answers')}>
      {options.map((o, i) => {
        const style = ANSWER_STYLES[i];
        const isPicked = picked === i;
        const isCorrect = revealed && correct === i;
        const dim = revealed ? !isCorrect : picked !== null && picked !== undefined && !isPicked;
        const count = distribution?.[i] ?? 0;
        return (
          <motion.button
            key={i}
            type="button"
            disabled={disabled || !onPick}
            onClick={() => onPick?.(i)}
            whileTap={onPick && !disabled ? { scale: 0.96 } : undefined}
            animate={{ opacity: dim ? 0.35 : 1, scale: isPicked && !revealed ? 1.02 : 1 }}
            transition={{ duration: 0.2 }}
            className={`relative flex items-center gap-4 overflow-hidden rounded-card text-left font-bold text-white shadow-lift outline-offset-4 disabled:cursor-default ${
              big ? 'min-h-[68px] p-4 text-lg sm:min-h-[120px] sm:p-5 sm:text-2xl' : 'min-h-[64px] p-4 text-base sm:min-h-[96px] sm:text-lg'
            } ${isPicked && !revealed ? 'ring-4 ring-white/80' : ''}`}
            style={{ background: style.color }}
            aria-pressed={isPicked}
            aria-label={`${i + 1}. ${o.text}${isCorrect ? ` — ${t('game.correctAnswer')}` : ''}`}
          >
            {distribution && total > 0 ? (
              <motion.span
                className="absolute inset-y-0 left-0 bg-black/15"
                initial={{ width: 0 }}
                animate={{ width: `${(count / total) * 100}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                aria-hidden="true"
              />
            ) : null}
            <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-black/15">
              <AnswerShape index={i} size={26} color="#fff" />
            </span>
            <span className="relative flex-1 break-words leading-snug drop-shadow-sm">{o.text}</span>
            {distribution ? <span className="relative font-display text-2xl font-black">{count}</span> : null}
            {revealed ? (
              <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/25">
                {isCorrect ? <IconCheck size={22} strokeWidth={3.5} /> : <IconX size={20} strokeWidth={3} />}
              </span>
            ) : onPick ? (
              <span className="relative hidden h-7 w-7 shrink-0 place-items-center rounded-lg bg-black/15 text-sm sm:grid" aria-hidden="true">
                {i + 1}
              </span>
            ) : null}
          </motion.button>
        );
      })}
    </div>
  );
}

export function QuestionHeader({ index, total, text, image, points }: { index: number; total: number; text: string; image: string | null; points: string }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4 text-center">
      <div className="flex items-center justify-center gap-2 text-sm font-bold text-muted">
        <span>{t('game.questionOf', { n: index + 1, total })}</span>
        {points === 'double' ? <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-amber-600 dark:text-amber-300">{t('game.doublePoints')}</span> : null}
        {points === 'none' ? <span className="rounded-full bg-line/10 px-2 py-0.5">{t('game.noPoints')}</span> : null}
      </div>
      <h2 className="mx-auto max-w-3xl text-balance text-2xl font-bold leading-tight sm:text-4xl">{text}</h2>
      {image ? <img src={assetUrl(image)} alt="" className="mx-auto max-h-56 rounded-card object-contain sm:max-h-72" /> : null}
    </div>
  );
}

/* ---------------- Players ---------------- */

export function PlayerChips({ players, onKick, teams, meId }: { players: PublicPlayer[]; onKick?: (pid: string) => void; teams?: TeamOption[]; meId?: string | null }) {
  const { t } = useTranslation();
  return (
    <ul className="flex flex-wrap justify-center gap-2.5" aria-label={t('game.players')}>
      <AnimatePresence initial={false}>
        {players.map((p) => (
          <motion.li
            key={p.pid}
            layout
            initial={{ opacity: 0, scale: 0.6, y: 10 }}
            animate={{ opacity: p.connected ? 1 : 0.45, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ type: 'spring', stiffness: 400, damping: 24 }}
            className={`group flex items-center gap-2 rounded-full border bg-surface/80 py-1.5 pl-1.5 pr-3 text-sm font-bold ${p.pid === meId ? 'border-cyan' : 'border-line/10'}`}
            style={teams && p.teamKey ? { boxShadow: `inset 0 -3px 0 ${teamColor(p.teamKey, teams)}` } : undefined}
          >
            <Avatar avatar={p.avatar} color={p.color} size={30} />
            <span className="max-w-[140px] truncate">{p.nickname}</span>
            {!p.connected ? <span className="text-xs text-muted">({t('game.offline')})</span> : null}
            {onKick && !p.isHost ? (
              <button
                type="button"
                onClick={() => onKick(p.pid)}
                className="ml-1 grid h-6 w-6 place-items-center rounded-full text-muted opacity-60 transition hover:bg-coral/20 hover:text-coral group-hover:opacity-100"
                aria-label={t('game.kick', { name: p.nickname })}
                title={t('game.kick', { name: p.nickname })}
              >
                <IconX size={14} strokeWidth={3} />
              </button>
            ) : null}
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}

/* ---------------- Leaderboard ---------------- */

export function LeaderboardList({ entries, meId, teams }: { entries: LeaderboardEntry[]; meId?: string | null; teams?: TeamOption[] }) {
  const { t } = useTranslation();
  return (
    <LayoutGroup>
      <ol className="space-y-2" aria-label={t('game.leaderboard')}>
        {entries.map((e) => {
          const moved = e.prevRank !== null ? e.prevRank - e.rank : 0;
          return (
            <motion.li
              key={e.pid}
              layout
              transition={{ type: 'spring', stiffness: 260, damping: 28 }}
              className={`flex items-center gap-3 rounded-card border px-4 py-3 ${e.pid === meId ? 'border-cyan bg-cyan/10' : 'border-line/10 bg-surface/70'}`}
            >
              <span className={`w-8 text-center font-display text-lg font-black ${e.rank <= 3 ? 'text-amber-500 dark:text-amber-300' : 'text-muted'}`}>{e.rank}</span>
              <Avatar avatar={e.avatar} color={e.color} size={36} />
              <span className="min-w-0 flex-1 truncate font-bold">
                {e.nickname}
                {teams && e.teamKey ? (
                  <span className="ml-2 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: teamColor(e.teamKey, teams) }} aria-hidden="true" />
                ) : null}
              </span>
              {moved > 0 ? (
                <span className="text-xs font-black text-emerald-500" aria-label={t('game.movedUp', { n: moved })}>
                  ▲{moved}
                </span>
              ) : moved < 0 ? (
                <span className="text-xs font-black text-coral" aria-label={t('game.movedDown', { n: -moved })}>
                  ▼{-moved}
                </span>
              ) : null}
              <CountUp value={e.score} className="font-display text-lg font-extrabold" />
            </motion.li>
          );
        })}
      </ol>
    </LayoutGroup>
  );
}

export function TeamStandings({ standings }: { standings: TeamStanding[] }) {
  const { t } = useTranslation();
  if (!standings.length) return null;
  const max = Math.max(...standings.map((s) => s.score), 1);
  return (
    <div className="space-y-2.5" aria-label={t('game.teamStandings')}>
      {standings.map((s) => (
        <div key={s.key} className="rounded-card border border-line/10 bg-surface/70 p-3">
          <div className="mb-2 flex items-center justify-between gap-3 text-sm font-bold">
            <span className="flex items-center gap-2">
              <span className="font-display">{s.rank}.</span>
              <span className="h-3 w-3 rounded-full" style={{ background: s.color ?? '#8B5CF6' }} aria-hidden="true" />
              {teamLabel(t, s)}
              <span className="text-xs font-semibold text-muted">· {t('game.membersCount', { count: s.members })}</span>
            </span>
            <CountUp value={s.score} className="font-display" />
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-line/10">
            <motion.div className="h-full rounded-full" style={{ background: s.color ?? '#8B5CF6' }} initial={{ width: 0 }} animate={{ width: `${(s.score / max) * 100}%` }} transition={{ duration: 0.8 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Podium({ entries }: { entries: LeaderboardEntry[] }) {
  const { t } = useTranslation();
  const top = [entries[1], entries[0], entries[2]];
  const heights = ['h-28', 'h-40', 'h-20'];
  const delays = [0.5, 1, 0.2];
  const medals = ['🥈', '🥇', '🥉'];
  return (
    <div className="flex items-end justify-center gap-3 sm:gap-6" aria-label={t('game.podium')}>
      {top.map((e, i) =>
        e ? (
          <motion.div
            key={e.pid}
            className="flex w-24 flex-col items-center sm:w-36"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: delays[i], type: 'spring', stiffness: 160, damping: 18 }}
          >
            <span className="text-3xl" aria-hidden="true">
              {medals[i]}
            </span>
            <Avatar avatar={e.avatar} color={e.color} size={i === 1 ? 72 : 56} />
            <span className="mt-2 max-w-full truncate text-center text-sm font-extrabold sm:text-base">{e.nickname}</span>
            <span className="font-display text-sm font-bold text-muted">
              <CountUp value={e.score} />
            </span>
            <div className={`mt-2 w-full rounded-t-2xl brand-gradient ${heights[i]} grid place-items-start justify-center pt-3 font-display text-3xl font-black text-white/90`}>
              {e.rank}
            </div>
          </motion.div>
        ) : (
          <div key={i} className="w-24 sm:w-36" />
        )
      )}
    </div>
  );
}

export function ReconnectBanner({ show }: { show: boolean }) {
  const { t } = useTranslation();
  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          className="fixed inset-x-0 top-16 z-[60] mx-auto flex w-fit items-center gap-2 rounded-full bg-amber-400 px-4 py-2 text-sm font-extrabold text-navy-950 shadow-lift"
          role="status"
          aria-live="assertive"
        >
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-navy-950" />
          {t('game.reconnecting')}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

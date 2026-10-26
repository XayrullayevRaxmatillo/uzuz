import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import type { FinishedPayload, TeamOption, XpPayload } from '@uzuz/shared';
import { Button, ButtonLink } from '../ui';
import { Confetti, CountUp } from './visuals';
import { LeaderboardList, Podium, TeamStandings } from './parts';
import { shareLink, absoluteUrl } from '../../lib/share';
import { useToast } from '../../context/ToastContext';
import { IconShare } from '../icons';

export function FinishedView({
  data,
  xp,
  code,
  isHost,
  quizTitle,
  teams,
  onPlayAgain,
  meId
}: {
  data: FinishedPayload;
  xp: XpPayload | null;
  code: string;
  isHost: boolean;
  quizTitle: string;
  teams: TeamOption[];
  onPlayAgain?: () => void;
  meId?: string | null;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const you = data.you;
  const celebrate = you ? you.rank <= 3 : true;

  const share = async () => {
    const url = absoluteUrl(`/room/${code}/results`);
    const text = you ? t('game.shareText', { rank: you.rank, score: you.score, quiz: quizTitle }) : quizTitle;
    const r = await shareLink({ title: 'UZUZ', text, url });
    if (r === 'copied') toast.success(t('common.linkCopied'));
  };

  return (
    <div className="space-y-10">
      <Confetti run={celebrate} />
      <div className="text-center">
        <p className="mb-2 font-semibold text-muted">{quizTitle}</p>
        <h1 className="text-3xl font-black sm:text-5xl">{t('game.finishedTitle')}</h1>
      </div>

      <Podium entries={data.standings} />

      {you ? (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
          className="panel mx-auto max-w-2xl p-6"
          aria-label={t('game.yourResult')}
        >
          <div className="grid grid-cols-2 gap-4 text-center sm:grid-cols-4">
            <Stat label={t('game.place')} value={`${you.rank}/${data.playerCount}`} />
            <Stat label={t('game.score')} value={<CountUp value={you.score} />} />
            <Stat label={t('game.accuracy')} value={`${you.accuracy}%`} />
            <Stat label={t('game.bestStreak')} value={`🔥 ${you.bestStreak}`} />
          </div>
          {xp ? (
            <div className="mt-5 rounded-card bg-violet/10 p-4 text-center">
              {xp.eligible ? (
                <p className="font-bold">
                  {t('game.xpGained', { xp: xp.xpGained })} · {t('game.level', { level: xp.level })}
                </p>
              ) : (
                <p className="text-sm font-semibold text-muted">{t('game.xpNotEligible')}</p>
              )}
              {xp.newBadges.length ? (
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  {xp.newBadges.map((b) => (
                    <span key={b} className="rounded-full bg-amber-400/20 px-3 py-1 text-sm font-bold text-amber-700 dark:text-amber-300">
                      🏅 {t(`badges.${b}.name`)}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </motion.section>
      ) : null}

      {data.teams.length ? (
        <section className="mx-auto max-w-2xl">
          <h2 className="mb-3 text-xl font-bold">{t('game.teamStandings')}</h2>
          <TeamStandings standings={data.teams} />
        </section>
      ) : null}

      <section className="mx-auto max-w-2xl">
        <h2 className="mb-3 text-xl font-bold">{t('game.fullStandings')}</h2>
        <LeaderboardList entries={data.standings} meId={meId} teams={teams} />
      </section>

      <div className="flex flex-wrap justify-center gap-3">
        {isHost && onPlayAgain ? (
          <Button size="lg" onClick={onPlayAgain}>
            {t('game.playAgain')}
          </Button>
        ) : !isHost ? (
          <p className="w-full text-center text-sm font-semibold text-muted">{t('game.waitForHostAgain')}</p>
        ) : null}
        <Button size="lg" variant="secondary" onClick={share}>
          <IconShare size={18} /> {t('game.shareResult')}
        </Button>
        <ButtonLink to="/quizzes" size="lg" variant="ghost">
          {t('game.moreQuizzes')}
        </ButtonLink>
      </div>
      <p className="text-center text-sm text-muted">
        <Link to={`/room/${code}/results`} className="underline underline-offset-4 hover:text-ink">
          {t('game.resultsPage')}
        </Link>
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="font-display text-2xl font-black sm:text-3xl">{value}</div>
      <div className="mt-1 text-xs font-bold text-muted">{label}</div>
    </div>
  );
}

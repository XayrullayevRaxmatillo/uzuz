import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { normalizeRoomCode, type LeaderboardEntry } from '@uzuz/shared';
import { api } from '../lib/api';
import { useAsync } from '../hooks/useAsync';
import { formatDate } from '../i18n';
import { ButtonLink, Center, PageLoader } from '../components/ui';
import { LeaderboardList, Podium, TeamStandings } from '../components/game/parts';

interface ResultsDTO {
  roomCode: string;
  quizTitle: string;
  quizSlug: string | null;
  mode: string;
  questionCount: number;
  playerCount: number;
  finishedAt: string;
  players: { pid: string; nickname: string; avatar: number; color: number; score: number; correct: number; rank: number; teamKey: string | null; isYou: boolean }[];
  teams: { key: string; name: string; color: string | null; score: number; members: number; rank: number }[];
}

export default function Results() {
  const { t } = useTranslation();
  const code = normalizeRoomCode(useParams().code ?? '');
  const { data, loading, error } = useAsync((signal) => api<ResultsDTO>(`/rooms/${code}/results`, { signal }), [code]);

  if (loading) return <PageLoader />;
  if (error || !data) {
    return (
      <Center>
        <h1 className="text-2xl font-bold">{t('results.notFoundTitle')}</h1>
        <p className="max-w-md text-muted">{t('results.notFoundText')}</p>
        <ButtonLink to="/quizzes">{t('nav.quizzes')}</ButtonLink>
      </Center>
    );
  }

  const entries: LeaderboardEntry[] = data.players.map((p) => ({ ...p, prevRank: null }));
  const me = data.players.find((p) => p.isYou);

  return (
    <div className="container-page max-w-3xl space-y-10 py-10">
      <div className="text-center">
        <p className="text-sm font-semibold text-muted">
          {t('game.roomCode', { code: data.roomCode })} · {formatDate(data.finishedAt)}
        </p>
        <h1 className="mt-2 text-3xl font-black sm:text-4xl">{data.quizTitle}</h1>
        <p className="mt-2 text-muted">
          {t('game.playersCount', { count: data.playerCount })} · {t('quiz.questionsCount', { count: data.questionCount })}
        </p>
        {me ? <p className="mt-3 font-bold text-cyan-600 dark:text-cyan">{t('results.yourRank', { rank: me.rank, score: me.score })}</p> : null}
      </div>
      <Podium entries={entries} />
      {data.teams.length ? <TeamStandings standings={data.teams} /> : null}
      <LeaderboardList entries={entries} meId={me?.pid} />
      <div className="flex flex-wrap justify-center gap-3">
        {data.quizSlug ? <ButtonLink to={`/quizzes/${data.quizSlug}`}>{t('results.playThisQuiz')}</ButtonLink> : null}
        <ButtonLink to="/quizzes" variant="secondary">
          {t('game.moreQuizzes')}
        </ButtonLink>
      </div>
      <p className="text-center text-xs text-muted">
        <Link to="/privacy" className="underline underline-offset-4">
          {t('results.privacyNote')}
        </Link>
      </p>
    </div>
  );
}

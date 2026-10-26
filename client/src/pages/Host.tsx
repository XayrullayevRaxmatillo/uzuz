import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import { normalizeRoomCode } from '@uzuz/shared';
import { useSession } from '../context/SessionContext';
import { useToast } from '../context/ToastContext';
import { useGameRoom } from '../hooks/useGameRoom';
import { errorMessage } from '../lib/errors';
import { absoluteUrl, copyText } from '../lib/share';
import { Button, ButtonLink, Center, PageLoader } from '../components/ui';
import { ShapeRow } from '../components/Shape';
import { CircularTimer, CountdownOverlay } from '../components/game/visuals';
import { AnswerGrid, LeaderboardList, PlayerChips, QuestionHeader, ReconnectBanner, TeamStandings, teamColor, teamLabel } from '../components/game/parts';
import { FinishedView } from '../components/game/FinishedView';
import { IconCopy, IconLock, IconUnlock } from '../components/icons';

export default function Host() {
  const { t } = useTranslation();
  const params = useParams();
  const code = normalizeRoomCode(params.code ?? '');
  const { session } = useSession();
  const toast = useToast();
  const game = useGameRoom(code, 'host', !!session);
  const { state } = game;

  const run = async (fn: () => Promise<{ ok: boolean; code?: string }>) => {
    const r = await fn();
    if (!r.ok) toast.error(errorMessage(t, (r as { code?: string }).code));
  };

  if (!session || state.joinStatus === 'idle' || state.joinStatus === 'joining') return <PageLoader />;

  if (state.joinStatus === 'error' || state.closed) {
    return (
      <Center>
        <ShapeRow size={20} />
        <h1 className="text-2xl font-bold">{state.joinError?.code === 'NOT_HOST' ? t('host.notHostTitle') : t('game.roomNotFoundTitle')}</h1>
        <p className="max-w-md text-muted">{state.joinError?.code === 'NOT_HOST' ? t('host.notHostText') : t('game.roomNotFoundText')}</p>
        <div className="flex gap-3">
          {state.joinError?.code === 'NOT_HOST' ? <ButtonLink to={`/room/${code}/play`}>{t('host.joinAsPlayer')}</ButtonLink> : null}
          <ButtonLink to="/quizzes" variant="secondary">
            {t('nav.quizzes')}
          </ButtonLink>
        </div>
      </Center>
    );
  }

  const room = state.room;
  if (!room) return <PageLoader />;
  const joinUrl = absoluteUrl(`/join/${code}`);
  const displayHost = window.location.host;

  return (
    <div className="container-page max-w-6xl py-6 sm:py-10">
      <ReconnectBanner show={!state.connected} />

      <AnimatePresence mode="wait">
        <motion.div key={`${room.phase}-${room.questionIndex}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          {room.phase === 'LOBBY' && (
            <div className="space-y-8">
              <section className="panel grid gap-8 p-6 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center">
                <div className="min-w-0">
                  <p className="font-semibold text-muted">{t('host.joinAt', { host: displayHost })}</p>
                  <p className="mt-1 text-muted">{t('host.enterCode')}</p>
                  <button
                    type="button"
                    onClick={async () => {
                      if (await copyText(code)) toast.success(t('host.codeCopied'));
                    }}
                    className="group mt-3 flex items-center gap-4 rounded-card text-left"
                    aria-label={t('host.copyCode', { code })}
                  >
                    <span className="font-display text-[2.6rem] font-black tracking-[0.1em] text-gradient sm:text-7xl lg:text-8xl">{code}</span>
                    <IconCopy size={26} className="text-muted opacity-60 transition group-hover:opacity-100" />
                  </button>
                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={async () => {
                        if (await copyText(joinUrl)) toast.success(t('common.linkCopied'));
                      }}
                    >
                      <IconCopy size={16} /> {t('host.copyLink')}
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => run(() => game.lock(!room.locked))} aria-pressed={room.locked}>
                      {room.locked ? <IconLock size={16} /> : <IconUnlock size={16} />}
                      {room.locked ? t('host.locked') : t('host.lock')}
                    </Button>
                    <span className="text-sm font-semibold text-muted">
                      {t(`modes.${room.mode}`)} · {room.settings.isPublic ? t('host.public') : t('host.private')}
                    </span>
                  </div>
                </div>
                <div className="mx-auto rounded-card bg-white p-4 shadow-lift">
                  <QRCodeSVG value={joinUrl} size={180} level="M" marginSize={0} title={t('host.qrTitle')} />
                </div>
              </section>

              <section className="text-center">
                <div className="mb-5 flex flex-wrap items-center justify-center gap-4">
                  <h2 className="text-2xl font-bold">{t('game.playersCount', { count: state.players.length })}</h2>
                  <Button size="lg" onClick={() => run(game.start)} disabled={state.players.length === 0}>
                    {t('game.start')}
                  </Button>
                </div>
                {state.players.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-8 text-muted">
                    <ShapeRow size={18} animate />
                    <p>{t('host.waitingPlayers')}</p>
                  </div>
                ) : room.mode === 'team' ? (
                  <div className="grid gap-4 text-left sm:grid-cols-2 lg:grid-cols-4">
                    {[...room.teams, { key: '__none', name: t('host.noTeam'), color: null, teamId: null }].map((tm) => {
                      const members = state.players.filter((p) => (tm.key === '__none' ? !p.teamKey : p.teamKey === tm.key));
                      if (tm.key === '__none' && members.length === 0) return null;
                      return (
                        <div key={tm.key} className="panel p-4">
                          <h3 className="mb-3 flex items-center gap-2 font-bold">
                            <span className="h-3 w-3 rounded-full" style={{ background: tm.key === '__none' ? '#8892B0' : teamColor(tm.key, room.teams) }} />
                            {tm.key === '__none' ? tm.name : teamLabel(t, tm)} <span className="text-sm text-muted">({members.length})</span>
                          </h3>
                          <PlayerChips players={members} onKick={(pid) => run(() => game.kick(pid))} />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <PlayerChips players={state.players} onKick={(pid) => run(() => game.kick(pid))} />
                )}
                {room.mode === 'team' ? <p className="mt-4 text-sm text-muted">{t('host.teamAutoAssign')}</p> : null}
              </section>
            </div>
          )}

          {room.phase === 'COUNTDOWN' && state.countdown && (
            <CountdownOverlay endsAt={state.countdown.endsAt} label={t('game.questionOf', { n: state.countdown.index + 1, total: state.countdown.total })} />
          )}

          {room.phase === 'QUESTION' && state.question && (
            <div className="space-y-8">
              <div className="flex items-center justify-between gap-4">
                <CircularTimer endsAt={state.question.endsAt} totalMs={state.question.endsAt - state.question.startedAt} size={110} label={t('game.timeLeft')} />
                <div className="text-center">
                  <p className="font-display text-5xl font-black">{state.answerCount?.answered ?? 0}</p>
                  <p className="text-sm font-bold text-muted">{t('host.answers', { total: state.answerCount?.total ?? state.players.length })}</p>
                </div>
                <Button variant="secondary" onClick={() => run(game.next)}>
                  {t('host.skip')}
                </Button>
              </div>
              <QuestionHeader index={state.question.index} total={state.question.total} text={state.question.text} image={state.question.image} points={state.question.points} />
              <AnswerGrid options={state.question.options} big />
            </div>
          )}

          {room.phase === 'REVEAL' && state.reveal && state.question && (
            <div className="space-y-6">
              <QuestionHeader index={state.question.index} total={state.question.total} text={state.question.text} image={null} points={state.question.points} />
              <AnswerGrid options={state.question.options} correct={state.reveal.correctOption} distribution={state.reveal.distribution} big />
              {state.reveal.explanation ? <p className="panel mx-auto max-w-3xl p-4 text-center">💡 {state.reveal.explanation}</p> : null}
              <div className="flex justify-center">
                <Button size="lg" onClick={() => run(game.next)}>
                  {t('host.showLeaderboard')}
                </Button>
              </div>
            </div>
          )}

          {room.phase === 'LEADERBOARD' && state.leaderboard && (
            <div className="mx-auto max-w-3xl space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-3xl font-bold">{t('game.leaderboard')}</h2>
                {state.leaderboard.isLast ? (
                  <p className="font-semibold text-muted">{t('host.finalComing')}</p>
                ) : (
                  <Button size="lg" onClick={() => run(game.next)}>
                    {t('host.nextQuestion')}
                  </Button>
                )}
              </div>
              {state.leaderboard.teams.length ? <TeamStandings standings={state.leaderboard.teams} /> : null}
              <LeaderboardList entries={state.leaderboard.entries} teams={room.teams} />
              {room.autoMode && !state.leaderboard.isLast ? <p className="text-center text-sm text-muted">{t('host.autoNext')}</p> : null}
            </div>
          )}

          {room.phase === 'FINISHED' && state.finished && (
            <FinishedView data={state.finished} xp={null} code={code} isHost quizTitle={room.quiz.title} teams={room.teams} onPlayAgain={() => run(game.playAgain)} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

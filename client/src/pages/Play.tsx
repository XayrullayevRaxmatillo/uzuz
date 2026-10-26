import { useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'motion/react';
import { COLOR_TEAMS, normalizeRoomCode } from '@uzuz/shared';
import { useSession } from '../context/SessionContext';
import { useToast } from '../context/ToastContext';
import { useGameRoom } from '../hooks/useGameRoom';
import { useAsync } from '../hooks/useAsync';
import { api } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { NicknameForm, type NicknameValue } from '../components/NicknameForm';
import { Avatar } from '../components/Avatar';
import { Button, ButtonLink, Center, PageLoader } from '../components/ui';
import { ShapeRow } from '../components/Shape';
import { CircularTimer, CountdownOverlay, CountUp } from '../components/game/visuals';
import { AnswerGrid, LeaderboardList, PlayerChips, QuestionHeader, ReconnectBanner, TeamStandings, teamColor, teamLabel } from '../components/game/parts';
import { FinishedView } from '../components/game/FinishedView';

interface RoomInfo {
  code: string;
  phase: string;
  mode: 'classic' | 'team' | 'solo';
  quizTitle: string;
  questionCount: number;
  playerCount: number;
  maxPlayers: number;
  locked: boolean;
  isHost: boolean;
  isPlayer: boolean;
}

export default function Play() {
  const { t } = useTranslation();
  const params = useParams();
  const code = normalizeRoomCode(params.code ?? '');
  const navigate = useNavigate();
  const toast = useToast();
  const { session, profile, saveProfile } = useSession();
  const game = useGameRoom(code, 'player', !!session);
  const { state } = game;
  const info = useAsync<RoomInfo>((signal) => api<RoomInfo>(`/rooms/${code}`, { signal }), [code]);
  const autoJoined = useRef(false);

  // Auto-join when we already belong to this room (reconnect from another tab) or for our own solo game.
  useEffect(() => {
    if (!info.data || !session || autoJoined.current || state.joinStatus !== 'idle') return;
    if (info.data.isPlayer) {
      autoJoined.current = true;
      void game.join({});
    } else if (info.data.mode === 'solo' && info.data.isHost && (profile?.nickname || session.nickname)) {
      autoJoined.current = true;
      void game.join(profile ?? { nickname: session.nickname ?? undefined, avatar: session.avatar, color: session.color });
    }
  }, [info.data, session, profile, state.joinStatus, game]);

  if (!session || (info.loading && !info.data)) return <PageLoader />;

  if (state.kicked) {
    return (
      <Center>
        <h1 className="text-2xl font-bold">{t('game.kickedTitle')}</h1>
        <p className="text-muted">{t('game.kickedText')}</p>
        <ButtonLink to="/">{t('common.home')}</ButtonLink>
      </Center>
    );
  }

  if (state.closed || (info.error && state.joinStatus !== 'joined')) {
    return (
      <Center>
        <ShapeRow size={20} />
        <h1 className="text-2xl font-bold">{t('game.roomNotFoundTitle')}</h1>
        <p className="max-w-md text-muted">{t('game.roomNotFoundText')}</p>
        <div className="flex gap-3">
          <ButtonLink to="/join">{t('join.title')}</ButtonLink>
          <ButtonLink to="/quizzes" variant="secondary">
            {t('nav.quizzes')}
          </ButtonLink>
        </div>
      </Center>
    );
  }

  /* -------- Join step -------- */
  if (state.joinStatus !== 'joined') {
    const onJoin = async (v: NicknameValue) => {
      saveProfile(v);
      const ack = await game.join(v);
      if (!ack.ok && ack.code !== 'NICKNAME_TAKEN' && ack.code !== 'NICKNAME_INVALID') toast.error(errorMessage(t, ack.code));
    };
    const nickError =
      state.joinError && (state.joinError.code === 'NICKNAME_TAKEN' || state.joinError.code === 'NICKNAME_INVALID') ? errorMessage(t, state.joinError.code) : null;
    return (
      <div className="container-page max-w-lg py-10">
        <div className="panel p-6 sm:p-8">
          <p className="mb-1 text-sm font-bold text-muted">{t('game.roomCode', { code })}</p>
          <h1 className="mb-1 text-2xl font-bold">{info.data?.quizTitle}</h1>
          <p className="mb-6 text-sm text-muted">
            {t('quiz.questionsCount', { count: info.data?.questionCount ?? 0 })} · {t('game.playersCount', { count: info.data?.playerCount ?? 0 })}
          </p>
          {state.joinError && !nickError ? (
            <p className="mb-4 rounded-btn bg-coral/10 p-3 text-sm font-semibold text-coral" role="alert">
              {errorMessage(t, state.joinError.code)}
            </p>
          ) : null}
          <NicknameForm
            onSubmit={onJoin}
            submitLabel={t('game.joinButton')}
            busy={state.joinStatus === 'joining'}
            serverError={nickError}
            suggestion={state.joinError?.suggestion ?? null}
          />
        </div>
      </div>
    );
  }

  const room = state.room;
  if (!room) return <PageLoader />;
  const me = state.players.find((p) => p.pid === state.pid);
  const isSoloHost = room.mode === 'solo' && room.isHost;

  return (
    <div className="container-page max-w-3xl py-6 sm:py-10">
      <ReconnectBanner show={!state.connected} />
      {state.notice === 'HOST_DISCONNECTED' && room.phase !== 'FINISHED' ? (
        <p className="mb-4 rounded-btn bg-amber-400/15 p-3 text-center text-sm font-semibold text-amber-700 dark:text-amber-300" role="status">
          {t('game.hostAway')}
        </p>
      ) : null}

      {/* Score strip */}
      {room.phase !== 'LOBBY' && room.phase !== 'FINISHED' && me ? (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-full border border-line/10 bg-surface/70 py-1.5 pl-1.5 pr-4">
          <div className="flex items-center gap-2">
            <Avatar avatar={me.avatar} color={me.color} size={34} />
            <span className="font-bold">{me.nickname}</span>
          </div>
          <span className="font-display text-lg font-extrabold">
            <CountUp value={state.reveal?.you?.score ?? state.leaderboard?.you?.score ?? me.score} />
          </span>
        </div>
      ) : null}

      <AnimatePresence mode="wait">
        <motion.div key={`${room.phase}-${room.questionIndex}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }}>
          {room.phase === 'LOBBY' && (
            <div className="space-y-8 text-center">
              <div className="flex flex-col items-center gap-3">
                {me ? <Avatar avatar={me.avatar} color={me.color} size={96} /> : null}
                <h1 className="text-2xl font-bold sm:text-3xl">{isSoloHost ? t('game.soloReady') : t('game.youAreIn')}</h1>
                <p className="text-muted">{isSoloHost ? t('game.soloHint') : t('game.waitingForHost')}</p>
                <p className="font-semibold">{room.quiz.title}</p>
              </div>

              {room.mode === 'team' && (
                <section className="panel p-5 text-left">
                  <h2 className="mb-3 font-bold">{t('game.pickTeam')}</h2>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {room.teams.map((tm) => {
                      const active = me?.teamKey === tm.key;
                      const count = state.players.filter((p) => p.teamKey === tm.key).length;
                      return (
                        <button
                          key={tm.key}
                          type="button"
                          onClick={async () => {
                            const r = await game.selectTeam(tm.key);
                            if (!r.ok) toast.error(errorMessage(t, r.code));
                          }}
                          aria-pressed={active}
                          className={`flex items-center justify-between gap-3 rounded-btn border px-4 py-3 text-left font-bold transition ${active ? 'border-cyan bg-cyan/10' : 'border-line/15 hover:border-line/30'}`}
                        >
                          <span className="flex items-center gap-2">
                            <span className="h-3.5 w-3.5 rounded-full" style={{ background: teamColor(tm.key, room.teams) }} />
                            {teamLabel(t, tm)}
                          </span>
                          <span className="text-sm text-muted">{count}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-3 text-xs text-muted">{t('game.teamHint', { count: COLOR_TEAMS.length })}</p>
                </section>
              )}

              {isSoloHost ? (
                <Button
                  size="xl"
                  onClick={async () => {
                    const r = await game.start();
                    if (!r.ok) toast.error(errorMessage(t, r.code));
                  }}
                >
                  {t('game.start')}
                </Button>
              ) : (
                <>
                  <ShapeRow size={18} animate />
                  <PlayerChips players={state.players} meId={state.pid} teams={room.mode === 'team' ? room.teams : undefined} />
                </>
              )}
            </div>
          )}

          {room.phase === 'COUNTDOWN' && state.countdown && (
            <CountdownOverlay endsAt={state.countdown.endsAt} label={t('game.questionOf', { n: state.countdown.index + 1, total: state.countdown.total })} />
          )}

          {room.phase === 'QUESTION' && state.question && (
            <div className="space-y-6">
              <div className="flex justify-center">
                <CircularTimer endsAt={state.question.endsAt} totalMs={state.question.endsAt - state.question.startedAt} label={t('game.timeLeft')} />
              </div>
              <QuestionHeader index={state.question.index} total={state.question.total} text={state.question.text} image={state.question.image} points={state.question.points} />
              <AnswerGrid
                options={state.question.options}
                picked={state.myAnswer}
                disabled={state.myAnswer !== null}
                big
                onPick={async (i) => {
                  const r = await game.answer(i);
                  if (!r.ok && r.code !== 'ALREADY_ANSWERED') toast.error(errorMessage(t, r.code));
                }}
              />
              <div className="text-center" aria-live="polite">
                {state.myAnswer !== null ? (
                  <p className="font-bold text-cyan-600 dark:text-cyan">{t('game.answerReceived')}</p>
                ) : (
                  <p className="text-sm text-muted">{t('game.keyboardHint')}</p>
                )}
                {state.answerCount ? <p className="mt-1 text-sm text-muted">{t('game.answeredCount', { n: state.answerCount.answered, total: state.answerCount.total })}</p> : null}
              </div>
            </div>
          )}

          {room.phase === 'REVEAL' && state.reveal && (
            <div className="space-y-6">
              {state.reveal.you ? (
                <motion.div
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                  className={`rounded-panel p-8 text-center text-white shadow-lift ${state.reveal.you.correct ? 'bg-emerald-500' : 'bg-coral'}`}
                  role="status"
                  aria-live="assertive"
                >
                  <p className="font-display text-3xl font-black sm:text-4xl">
                    {!state.reveal.you.answered ? t('game.noAnswer') : state.reveal.you.correct ? t('game.correct') : t('game.wrong')}
                  </p>
                  {state.reveal.you.correct ? (
                    <p className="mt-2 text-xl font-bold">
                      +{state.reveal.you.points + state.reveal.you.streakBonus}
                      {state.reveal.you.streakBonus ? <span className="ml-2 text-base opacity-90">({t('game.streakBonus', { n: state.reveal.you.streak, bonus: state.reveal.you.streakBonus })})</span> : null}
                    </p>
                  ) : null}
                  <p className="mt-3 font-semibold opacity-90">{t('game.yourPlace', { rank: state.reveal.you.rank })}</p>
                </motion.div>
              ) : null}
              {state.question ? <AnswerGrid options={state.question.options} picked={state.reveal.you?.option ?? null} correct={state.reveal.correctOption} distribution={state.reveal.distribution} /> : null}
              {state.reveal.explanation ? <p className="panel p-4 text-center text-sm">💡 {state.reveal.explanation}</p> : null}
            </div>
          )}

          {room.phase === 'LEADERBOARD' && state.leaderboard && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold">{state.leaderboard.isLast ? t('game.finalRound') : t('game.leaderboard')}</h2>
                {state.leaderboard.you ? <p className="mt-1 text-muted">{t('game.yourPlace', { rank: state.leaderboard.you.rank })}</p> : null}
              </div>
              {state.leaderboard.teams.length ? <TeamStandings standings={state.leaderboard.teams} /> : null}
              <LeaderboardList entries={state.leaderboard.entries.slice(0, 5)} meId={state.pid} teams={room.teams} />
              {!room.autoMode ? <p className="text-center text-sm text-muted">{t('game.waitingNext')}</p> : null}
            </div>
          )}

          {room.phase === 'FINISHED' && state.finished && (
            <FinishedView
              data={state.finished}
              xp={state.xp}
              code={code}
              isHost={room.isHost}
              quizTitle={room.quiz.title}
              teams={room.teams}
              meId={state.pid}
              onPlayAgain={
                isSoloHost
                  ? async () => {
                      const r = await game.playAgain();
                      if (!r.ok) toast.error(errorMessage(t, r.code));
                    }
                  : undefined
              }
            />
          )}
        </motion.div>
      </AnimatePresence>

      {room.phase === 'LOBBY' && (
        <div className="mt-10 text-center">
          <button type="button" onClick={() => navigate('/')} className="text-sm font-semibold text-muted underline underline-offset-4 hover:text-ink">
            {t('game.leave')}
          </button>
        </div>
      )}
    </div>
  );
}

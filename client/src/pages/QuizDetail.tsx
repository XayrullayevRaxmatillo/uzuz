import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { QuizCardDTO } from '@uzuz/shared';
import { api, assetUrl } from '../lib/api';
import { useAsync } from '../hooks/useAsync';
import { errorMessage } from '../lib/errors';
import { categoryMeta } from '../lib/categories';
import { useFavorites } from '../lib/favorites';
import { absoluteUrl, shareLink } from '../lib/share';
import { formatNumber, relativeTime } from '../i18n';
import { useToast } from '../context/ToastContext';
import { RoomSettingsModal } from '../components/RoomSettingsModal';
import { ReportModal } from '../components/ReportModal';
import { Avatar } from '../components/Avatar';
import { AnswerShape } from '../components/Shape';
import { Badge, Button, ButtonLink, Center, PageLoader } from '../components/ui';
import { IconEdit, IconFlag, IconHeart, IconPlay, IconShare, IconUsers } from '../components/icons';

interface QuizDetailDTO extends QuizCardDTO {
  visibility: 'public' | 'unlisted';
  tags: string[];
  canEdit: boolean;
  firstQuestion: { text: string; type: string; options: { text: string }[] } | null;
  topScores: { rank: number; nickname: string; avatar: number; color: number; score: number; correct: number }[];
}

export default function QuizDetail() {
  const { t } = useTranslation();
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const fav = useFavorites();
  const [hostOpen, setHostOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [soloBusy, setSoloBusy] = useState(false);
  const { data: quiz, error, loading } = useAsync((signal) => api<QuizDetailDTO>(`/quizzes/by-slug/${encodeURIComponent(slug)}`, { signal }), [slug]);

  if (loading) return <PageLoader />;
  if (error || !quiz) {
    return (
      <Center>
        <h1 className="text-2xl font-bold">{t('quiz.notFoundTitle')}</h1>
        <p className="text-muted">{errorMessage(t, error ?? 'QUIZ_NOT_FOUND')}</p>
        <ButtonLink to="/quizzes">{t('nav.quizzes')}</ButtonLink>
      </Center>
    );
  }

  const cat = categoryMeta(quiz.category);

  const playSolo = async () => {
    setSoloBusy(true);
    try {
      const r = await api<{ code: string }>('/rooms', { method: 'POST', body: { quizId: quiz.id, mode: 'solo', settings: { shuffleAnswers: true } } });
      navigate(`/room/${r.code}/play`);
    } catch (err) {
      toast.error(errorMessage(t, err));
    } finally {
      setSoloBusy(false);
    }
  };

  const share = async () => {
    const r = await shareLink({ title: quiz.title, text: t('quiz.shareText', { title: quiz.title }), url: absoluteUrl(`/quizzes/${quiz.slug}`) });
    if (r === 'copied') toast.success(t('common.linkCopied'));
  };

  return (
    <div className="container-page py-8 sm:py-12">
      <nav className="mb-6 text-sm font-semibold text-muted" aria-label={t('common.breadcrumb')}>
        <Link to="/quizzes" className="hover:text-ink">
          {t('nav.quizzes')}
        </Link>{' '}
        /{' '}
        <Link to={`/quizzes?category=${quiz.category}`} className="hover:text-ink">
          {t(`categories.${quiz.category}`)}
        </Link>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <div
            className="relative mb-6 h-48 overflow-hidden rounded-panel sm:h-64"
            style={{ background: quiz.cover ? undefined : `linear-gradient(135deg, ${cat.color}, ${cat.color}40 70%, transparent)` }}
          >
            {quiz.cover ? (
              <img src={assetUrl(quiz.cover)} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="absolute -bottom-6 right-6 text-[9rem] leading-none" aria-hidden="true">
                {cat.icon}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="violet">
              {cat.icon} {t(`categories.${quiz.category}`)}
            </Badge>
            <Badge>{t(`languages.${quiz.language}`)}</Badge>
            <Badge tone={quiz.difficulty === 'easy' ? 'green' : quiz.difficulty === 'medium' ? 'amber' : 'coral'}>{t(`difficulty.${quiz.difficulty}`)}</Badge>
            {quiz.visibility === 'unlisted' ? <Badge tone="amber">{t('create.unlisted')}</Badge> : null}
          </div>
          <h1 className="mt-4 text-3xl font-black leading-tight sm:text-5xl">{quiz.title}</h1>
          {quiz.description ? <p className="mt-4 max-w-2xl text-lg text-muted">{quiz.description}</p> : null}
          <p className="mt-4 text-sm font-semibold text-muted">
            {quiz.isOfficial ? t('quiz.byTeam') : t('quiz.byAuthor', { name: quiz.authorName })} · {relativeTime(quiz.createdAt)} ·{' '}
            {t('quiz.questionsCount', { count: quiz.questionCount })} · {t('quiz.plays', { count: quiz.plays, formatted: formatNumber(quiz.plays) })}
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="xl" onClick={() => setHostOpen(true)}>
              <IconUsers size={20} /> {t('quiz.host')}
            </Button>
            <Button size="xl" variant="cyan" onClick={playSolo} loading={soloBusy}>
              <IconPlay size={18} /> {t('quiz.playSolo')}
            </Button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" onClick={share}>
              <IconShare size={16} /> {t('common.share')}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => fav.toggle(quiz.id)} aria-pressed={fav.has(quiz.id)}>
              <IconHeart size={16} filled={fav.has(quiz.id)} /> {fav.has(quiz.id) ? t('quiz.unfavorite') : t('quiz.favorite')}
            </Button>
            {quiz.canEdit ? (
              <ButtonLink to={`/edit/${quiz.id}`} variant="ghost" size="sm">
                <IconEdit size={16} /> {t('common.edit')}
              </ButtonLink>
            ) : null}
            <Button variant="ghost" size="sm" onClick={() => setReportOpen(true)}>
              <IconFlag size={16} /> {t('report.button')}
            </Button>
          </div>

          {quiz.firstQuestion ? (
            <div className="panel mt-10 p-6">
              <p className="mb-2 text-sm font-bold text-muted">{t('quiz.preview')}</p>
              <p className="mb-4 font-display text-lg font-bold">{quiz.firstQuestion.text}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {quiz.firstQuestion.options.map((o, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-btn border border-line/10 bg-surface-2/60 px-3 py-2.5 text-sm font-semibold">
                    <AnswerShape index={i} size={18} />
                    {o.text}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <aside>
          <div className="panel p-6">
            <h2 className="mb-4 text-xl font-bold">{t('quiz.topScores')}</h2>
            {quiz.topScores.length ? (
              <ol className="space-y-2">
                {quiz.topScores.map((s) => (
                  <li key={`${s.rank}-${s.nickname}`} className="flex items-center gap-3 rounded-btn bg-line/[0.04] px-3 py-2">
                    <span className="w-6 text-center font-display font-black text-muted">{s.rank}</span>
                    <Avatar avatar={s.avatar} color={s.color} size={30} />
                    <span className="flex-1 truncate font-bold">{s.nickname}</span>
                    <span className="font-display font-bold">{formatNumber(s.score)}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-muted">{t('quiz.noScores')}</p>
            )}
          </div>
          {quiz.tags.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {quiz.tags.map((tag) => (
                <Link key={tag} to={`/quizzes?q=${encodeURIComponent(tag)}`} className="rounded-full bg-line/[0.06] px-3 py-1 text-sm font-semibold text-muted hover:text-ink">
                  #{tag}
                </Link>
              ))}
            </div>
          ) : null}
        </aside>
      </div>

      <RoomSettingsModal open={hostOpen} onClose={() => setHostOpen(false)} quizId={quiz.id} />
      <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} targetType="quiz" targetId={quiz.id} />
    </div>
  );
}

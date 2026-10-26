import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { QuizCardDTO } from '@uzuz/shared';
import { assetUrl } from '../lib/api';
import { formatNumber } from '../i18n';
import { categoryMeta } from '../lib/categories';
import { Badge } from './ui';
import { IconHeart } from './icons';

export function QuizCard({ quiz, favorite, onToggleFavorite }: { quiz: QuizCardDTO; favorite?: boolean; onToggleFavorite?: (id: string) => void }) {
  const { t } = useTranslation();
  const cat = categoryMeta(quiz.category);
  const cover = assetUrl(quiz.cover);
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-card border border-line/10 bg-surface/60 transition hover:-translate-y-0.5 hover:border-line/25 hover:shadow-lift">
      <div
        className="relative h-28 overflow-hidden"
        style={{ background: cover ? undefined : `linear-gradient(135deg, ${cat.color}, ${cat.color}55 70%, transparent)` }}
      >
        {cover ? (
          <img src={cover} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <span className="absolute -bottom-4 right-3 text-[5.5rem] leading-none opacity-90 drop-shadow-lg transition group-hover:scale-105" aria-hidden="true">
            {cat.icon}
          </span>
        )}
        <div className="absolute left-3 top-3 flex gap-1.5">
          <span className="rounded-full bg-navy-950/60 px-2.5 py-1 text-xs font-bold text-white backdrop-blur">{quiz.language.toUpperCase()}</span>
          {quiz.isOfficial ? <span className="rounded-full bg-white/90 px-2.5 py-1 text-xs font-bold text-navy-950">{t('quiz.official')}</span> : null}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <h3 className="font-display text-[1.02rem] font-bold leading-snug">
          <Link to={`/quizzes/${quiz.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none">
            {quiz.title}
          </Link>
        </h3>
        <p className="line-clamp-2 text-sm text-muted">{quiz.description || t(`categories.${quiz.category}`)}</p>
        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
          <Badge>{t('quiz.questionsCount', { count: quiz.questionCount })}</Badge>
          <Badge tone={quiz.difficulty === 'easy' ? 'green' : quiz.difficulty === 'medium' ? 'amber' : 'coral'}>{t(`difficulty.${quiz.difficulty}`)}</Badge>
          <Badge tone="violet">{t('quiz.plays', { count: quiz.plays, formatted: formatNumber(quiz.plays) })}</Badge>
        </div>
      </div>
      {onToggleFavorite ? (
        <button
          type="button"
          onClick={() => onToggleFavorite(quiz.id)}
          className={`absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full backdrop-blur transition ${
            favorite ? 'bg-coral text-white' : 'bg-navy-950/50 text-white hover:bg-navy-950/70'
          }`}
          aria-pressed={!!favorite}
          aria-label={favorite ? t('quiz.unfavorite') : t('quiz.favorite')}
        >
          <IconHeart size={17} filled={favorite} />
        </button>
      ) : null}
    </article>
  );
}

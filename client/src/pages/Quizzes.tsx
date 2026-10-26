import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CATEGORY_SLUGS, DIFFICULTIES, LANGS, type QuizCardDTO } from '@uzuz/shared';
import { api, qs } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { useFavorites } from '../lib/favorites';
import { categoryMeta } from '../lib/categories';
import { QuizCard } from '../components/QuizCard';
import { Button, ButtonLink, Chip, EmptyState, ErrorState, Select, Skeleton } from '../components/ui';
import { IconSearch } from '../components/icons';

interface ListResponse {
  items: QuizCardDTO[];
  total: number;
  page: number;
  pages: number;
}

export default function Quizzes() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const category = params.get('category') ?? '';
  const language = params.get('language') ?? '';
  const difficulty = params.get('difficulty') ?? '';
  const sort = params.get('sort') ?? 'popular';
  const tab = params.get('tab') ?? 'all';
  const [query, setQuery] = useState(params.get('q') ?? '');
  const [items, setItems] = useState<QuizCardDTO[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const fav = useFavorites();

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  // Debounced search box → URL
  useEffect(() => {
    const id = window.setTimeout(() => {
      if ((params.get('q') ?? '') !== query.trim()) setParam('q', query.trim());
    }, 350);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const q = params.get('q') ?? '';

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [category, language, difficulty, sort, q, tab]);

  useEffect(() => {
    if (tab === 'favorites') {
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    api<ListResponse>(`/quizzes${qs({ q, category, language, difficulty, sort, page, limit: 12 })}`, { signal: ctrl.signal })
      .then((r) => {
        setItems((prev) => (page === 1 ? r.items : [...prev, ...r.items.filter((i) => !prev.some((p) => p.id === i.id))]));
        setPages(r.pages);
        setTotal(r.total);
      })
      .catch((e) => {
        if ((e as Error).name !== 'AbortError') setError(e);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [q, category, language, difficulty, sort, page, tab, reloadTick]);

  // Favorites live in this browser only; fetch their cards by id.
  const [favItems, setFavItems] = useState<QuizCardDTO[] | null>(null);
  useEffect(() => {
    if (tab !== 'favorites') return;
    if (fav.ids.length === 0) {
      setFavItems([]);
      return;
    }
    const ctrl = new AbortController();
    setFavItems(null);
    api<ListResponse>(`/quizzes${qs({ ids: fav.ids.slice(0, 100).join(','), limit: 24 })}`, { signal: ctrl.signal })
      .then((r) => setFavItems(r.items))
      .catch((e) => {
        if ((e as Error).name !== 'AbortError') setFavItems([]);
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const list = tab === 'favorites' ? favItems?.filter((i) => fav.has(i.id)) ?? null : items;

  return (
    <div className="container-page py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black sm:text-4xl">{t('quizzes.title')}</h1>
          <p className="mt-1 text-muted">{t('quizzes.subtitle')}</p>
        </div>
        <ButtonLink to="/create" variant="secondary">
          {t('home.ctaCreate')}
        </ButtonLink>
      </div>

      <div className="panel mb-6 space-y-4 p-4 sm:p-5">
        <div className="relative">
          <IconSearch size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="search"
            className="field pl-12"
            placeholder={t('quizzes.searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={t('quizzes.search')}
          />
        </div>
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
          <Chip active={!category} onClick={() => setParam('category', '')}>
            {t('quizzes.allCategories')}
          </Chip>
          {CATEGORY_SLUGS.map((c) => (
            <Chip key={c} active={category === c} onClick={() => setParam('category', category === c ? '' : c)} color={categoryMeta(c).color}>
              <span aria-hidden="true">{categoryMeta(c).icon}</span> {t(`categories.${c}`)}
            </Chip>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Select value={language} onChange={(e) => setParam('language', e.target.value)} aria-label={t('quizzes.language')}>
            <option value="">{t('quizzes.anyLanguage')}</option>
            {LANGS.map((l) => (
              <option key={l} value={l}>
                {t(`languages.${l}`)}
              </option>
            ))}
          </Select>
          <Select value={difficulty} onChange={(e) => setParam('difficulty', e.target.value)} aria-label={t('quizzes.difficulty')}>
            <option value="">{t('quizzes.anyDifficulty')}</option>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {t(`difficulty.${d}`)}
              </option>
            ))}
          </Select>
          <Select value={sort} onChange={(e) => setParam('sort', e.target.value === 'popular' ? '' : e.target.value)} aria-label={t('quizzes.sort')}>
            <option value="popular">{t('quizzes.sortPopular')}</option>
            <option value="new">{t('quizzes.sortNew')}</option>
          </Select>
          <div className="flex rounded-btn border border-line/15 p-1" role="tablist">
            {(['all', 'favorites'] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={tab === k}
                onClick={() => setParam('tab', k === 'all' ? '' : k)}
                className={`flex-1 rounded-[10px] text-sm font-bold transition ${tab === k ? 'bg-ink text-bg' : 'text-muted'}`}
              >
                {k === 'all' ? t('quizzes.tabAll') : `♥ ${t('quizzes.tabFavorites')}`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {tab === 'all' && !loading && !error ? <p className="mb-4 text-sm font-semibold text-muted">{t('quizzes.found', { count: total })}</p> : null}

      {error ? (
        <ErrorState message={errorMessage(t, error)} onRetry={() => setReloadTick((n) => n + 1)} />
      ) : list === null || (loading && page === 1) ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      ) : list.length === 0 ? (
        tab === 'favorites' ? (
          <EmptyState title={t('quizzes.noFavorites')} text={t('quizzes.noFavoritesText')} />
        ) : (
          <EmptyState title={t('quizzes.empty')} text={t('quizzes.emptyText')} action={<ButtonLink to="/create">{t('home.ctaCreate')}</ButtonLink>} />
        )
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((quiz) => (
              <QuizCard key={quiz.id} quiz={quiz} favorite={fav.has(quiz.id)} onToggleFavorite={fav.toggle} />
            ))}
          </div>
          {tab === 'all' && page < pages ? (
            <div className="mt-8 flex justify-center">
              <Button variant="secondary" size="lg" loading={loading} onClick={() => setPage((p) => p + 1)}>
                {t('common.loadMore')}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

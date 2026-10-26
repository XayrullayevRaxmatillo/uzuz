import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import {
  CATEGORY_SLUGS,
  DIFFICULTIES,
  LANGS,
  POINT_MODES,
  QUIZ_MAX_QUESTIONS,
  TIME_LIMITS,
  questionSchema,
  quizInputSchema,
  type CategorySlug,
  type Difficulty,
  type Lang,
  type PointMode,
  type QuestionType
} from '@uzuz/shared';
import { api, ApiError, assetUrl } from '../lib/api';
import { KEYS, storage } from '../lib/storage';
import { uploadImage } from '../lib/image';
import { errorMessage } from '../lib/errors';
import { absoluteUrl, copyText } from '../lib/share';
import { currentLang } from '../i18n';
import { useToast } from '../context/ToastContext';
import { Button, ButtonLink, Field, Modal, PageLoader, Select } from '../components/ui';
import { AnswerShape } from '../components/Shape';
import { AnswerGrid, QuestionHeader } from '../components/game/parts';
import { IconCopy, IconDown, IconDuplicate, IconEye, IconGrip, IconImage, IconPlus, IconTrash, IconUp, IconX } from '../components/icons';

interface DraftOption {
  text: string;
  correct: boolean;
}
interface DraftQuestion {
  id: string;
  type: QuestionType;
  text: string;
  image: string | null;
  options: DraftOption[];
  timeLimit: number;
  points: PointMode;
  explanation: string;
}
interface Draft {
  title: string;
  description: string;
  category: CategorySlug;
  language: Lang;
  difficulty: Difficulty;
  tags: string[];
  visibility: 'public' | 'unlisted';
  cover: string | null;
  questions: DraftQuestion[];
}

const uid = () => Math.random().toString(36).slice(2, 10);

function tfLabels(lang: Lang): [string, string] {
  return lang === 'ru' ? ['Верно', 'Неверно'] : lang === 'en' ? ['True', 'False'] : ['To‘g‘ri', 'Noto‘g‘ri'];
}

function newQuestion(type: QuestionType = 'single', lang: Lang = 'uz'): DraftQuestion {
  const [tt, ff] = tfLabels(lang);
  return {
    id: uid(),
    type,
    text: '',
    image: null,
    options:
      type === 'boolean'
        ? [
            { text: tt, correct: true },
            { text: ff, correct: false }
          ]
        : [
            { text: '', correct: true },
            { text: '', correct: false },
            { text: '', correct: false },
            { text: '', correct: false }
          ],
    timeLimit: 20,
    points: 'standard',
    explanation: ''
  };
}

function emptyDraft(): Draft {
  const lang = currentLang();
  return {
    title: '',
    description: '',
    category: 'general',
    language: lang,
    difficulty: 'easy',
    tags: [],
    visibility: 'public',
    cover: null,
    questions: [newQuestion('single', lang)]
  };
}

function toPayload(d: Draft) {
  return {
    title: d.title,
    description: d.description,
    category: d.category,
    language: d.language,
    difficulty: d.difficulty,
    tags: d.tags,
    visibility: d.visibility,
    cover: d.cover,
    questions: d.questions.map((q) => ({
      type: q.type,
      text: q.text,
      image: q.image,
      options: q.options.filter((o) => q.type === 'boolean' || o.text.trim() !== '' || o.correct),
      timeLimit: q.timeLimit,
      points: q.points,
      explanation: q.explanation
    }))
  };
}

/** Human-friendly issues: "Savol 3: to‘g‘ri javobni belgilang". */
function useIssues(draft: Draft) {
  const { t } = useTranslation();
  return useMemo(() => {
    const r = quizInputSchema.safeParse(toPayload(draft));
    if (r.success) return [];
    const out: string[] = [];
    for (const issue of r.error.issues) {
      const [first, idx, field] = issue.path;
      let msg: string;
      if (first === 'questions' && typeof idx === 'number') {
        const where = t('create.questionN', { n: idx + 1 });
        if (issue.message === 'exactly_one_correct') msg = `${where}: ${t('create.issueCorrect')}`;
        else if (field === 'text') msg = `${where}: ${t('create.issueText')}`;
        else if (field === 'options') msg = `${where}: ${t('create.issueOptions')}`;
        else msg = `${where}: ${t('create.issueGeneric')}`;
      } else if (first === 'title') msg = issue.message === 'profanity' ? t('create.issueProfanity') : t('create.issueTitle');
      else if (first === 'questions') msg = t('create.issueNoQuestions');
      else msg = `${String(first)}: ${t('create.issueGeneric')}`;
      if (!out.includes(msg)) out.push(msg);
    }
    return out;
  }, [draft, t]);
}

export default function Create() {
  const { t } = useTranslation();
  const { quizId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const editing = !!quizId;
  const draftKey = editing ? `${KEYS.draft}_${quizId}` : KEYS.draft;

  const [draft, setDraft] = useState<Draft | null>(() => (editing ? null : storage.get<Draft | null>(KEYS.draft, null) ?? emptyDraft()));
  const [active, setActive] = useState(0);
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [loadError, setLoadError] = useState<'forbidden' | 'notfound' | null>(null);
  const [editKeyInput, setEditKeyInput] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [showIssues, setShowIssues] = useState(false);
  const [preview, setPreview] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [published, setPublished] = useState<{ slug: string; editKey?: string; id: string } | null>(null);
  const [tagInput, setTagInput] = useState('');
  const dragFrom = useRef<number | null>(null);

  const editKeys = storage.get<Record<string, string>>(KEYS.editKeys, {});

  /* ---------- Load for editing ---------- */
  const loadForEdit = useCallback(
    async (key?: string) => {
      if (!quizId) return;
      setLoadError(null);
      try {
        const k = key ?? storage.get<Record<string, string>>(KEYS.editKeys, {})[quizId];
        const q = await api<Omit<Draft, 'questions'> & { questions: Omit<DraftQuestion, 'id'>[] }>(`/quizzes/${quizId}/edit`, {
          headers: k ? { 'x-edit-key': k } : {}
        });
        if (key) storage.set(KEYS.editKeys, { ...storage.get<Record<string, string>>(KEYS.editKeys, {}), [quizId]: key });
        setDraft({ ...q, cover: q.cover ?? null, questions: q.questions.map((qq) => ({ ...qq, id: uid(), image: qq.image ?? null, explanation: qq.explanation ?? '' })) });
      } catch (err) {
        setLoadError(err instanceof ApiError && err.status === 403 ? 'forbidden' : 'notfound');
      }
    },
    [quizId]
  );

  useEffect(() => {
    if (editing) void loadForEdit();
    else setDraft(storage.get<Draft | null>(KEYS.draft, null) ?? emptyDraft());
  }, [editing, loadForEdit]);

  /* ---------- Autosave (local) ---------- */
  useEffect(() => {
    if (!draft || editing) return;
    setSaved('saving');
    const id = window.setTimeout(() => {
      storage.set(draftKey, draft);
      setSaved('saved');
    }, 800);
    return () => window.clearTimeout(id);
  }, [draft, draftKey, editing]);

  const issues = useIssues(draft ?? emptyDraft());

  const update = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const updateQ = (i: number, patch: Partial<DraftQuestion>) =>
    setDraft((d) => (d ? { ...d, questions: d.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)) } : d));

  const addQuestion = useCallback(
    (type: QuestionType = 'single') => {
      setDraft((d) => {
        if (!d || d.questions.length >= QUIZ_MAX_QUESTIONS) return d;
        const next = { ...d, questions: [...d.questions, newQuestion(type, d.language)] };
        setActive(next.questions.length - 1);
        return next;
      });
    },
    []
  );

  const move = useCallback((from: number, to: number) => {
    setDraft((d) => {
      if (!d || to < 0 || to >= d.questions.length || from === to) return d;
      const qs = [...d.questions];
      const [item] = qs.splice(from, 1);
      qs.splice(to, 0, item);
      return { ...d, questions: qs };
    });
    setActive(to);
  }, []);

  const duplicate = (i: number) =>
    setDraft((d) => {
      if (!d || d.questions.length >= QUIZ_MAX_QUESTIONS) return d;
      const qs = [...d.questions];
      qs.splice(i + 1, 0, { ...d.questions[i], id: uid(), options: d.questions[i].options.map((o) => ({ ...o })) });
      setActive(i + 1);
      return { ...d, questions: qs };
    });

  const remove = (i: number) =>
    setDraft((d) => {
      if (!d || d.questions.length <= 1) return d;
      const qs = d.questions.filter((_, j) => j !== i);
      setActive(Math.max(0, Math.min(i, qs.length - 1)));
      return { ...d, questions: qs };
    });

  /* ---------- Keyboard shortcuts ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      if (e.key.toLowerCase() === 'n') {
        e.preventDefault();
        addQuestion();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        move(active, active - 1);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        move(active, active + 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, addQuestion, move]);

  const onUpload = async (file: File | undefined, apply: (url: string) => void) => {
    if (!file) return;
    try {
      apply(await uploadImage(file));
    } catch (err) {
      const m = (err as Error).message;
      toast.error(m === 'size' ? t('create.imageTooBig') : m === 'type' ? t('create.imageType') : errorMessage(t, err));
    }
  };

  /* ---------- Publish / update ---------- */
  const publish = async () => {
    if (!draft) return;
    if (issues.length) {
      setShowIssues(true);
      toast.error(t('create.fixIssues'));
      return;
    }
    setPublishing(true);
    try {
      const body = toPayload(draft);
      if (editing && quizId) {
        const key = storage.get<Record<string, string>>(KEYS.editKeys, {})[quizId];
        const r = await api<{ id: string; slug: string }>(`/quizzes/${quizId}`, { method: 'PUT', body, headers: key ? { 'x-edit-key': key } : {} });
        toast.success(t('create.updated'));
        navigate(`/quizzes/${r.slug}`);
      } else {
        const r = await api<{ id: string; slug: string; editKey: string }>('/quizzes', { method: 'POST', body });
        storage.set(KEYS.editKeys, { ...storage.get<Record<string, string>>(KEYS.editKeys, {}), [r.id]: r.editKey });
        storage.remove(KEYS.draft);
        setPublished(r);
      }
    } catch (err) {
      toast.error(errorMessage(t, err));
    } finally {
      setPublishing(false);
    }
  };

  const deleteQuiz = async () => {
    if (!quizId || !window.confirm(t('create.confirmDelete'))) return;
    try {
      const key = editKeys[quizId];
      await api(`/quizzes/${quizId}`, { method: 'DELETE', headers: key ? { 'x-edit-key': key } : {} });
      toast.success(t('create.deleted'));
      navigate('/me');
    } catch (err) {
      toast.error(errorMessage(t, err));
    }
  };

  /* ---------- Render ---------- */
  if (editing && loadError === 'forbidden') {
    return (
      <div className="container-page max-w-lg py-16">
        <div className="panel p-6">
          <h1 className="mb-2 text-2xl font-bold">{t('create.editKeyTitle')}</h1>
          <p className="mb-5 text-muted">{t('create.editKeyText')}</p>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void loadForEdit(editKeyInput.trim());
            }}
          >
            <input className="field" value={editKeyInput} onChange={(e) => setEditKeyInput(e.target.value)} placeholder={t('create.editKeyPlaceholder')} aria-label={t('create.editKey')} />
            <Button type="submit">{t('common.continue')}</Button>
          </form>
        </div>
      </div>
    );
  }
  if (editing && loadError === 'notfound') {
    return (
      <div className="container-page py-16 text-center">
        <h1 className="text-2xl font-bold">{t('quiz.notFoundTitle')}</h1>
        <ButtonLink to="/create" className="mt-4">
          {t('home.ctaCreate')}
        </ButtonLink>
      </div>
    );
  }
  if (!draft) return <PageLoader />;

  const q = draft.questions[Math.min(active, draft.questions.length - 1)];
  const qi = Math.min(active, draft.questions.length - 1);

  const onDragStart = (i: number) => () => {
    dragFrom.current = i;
  };
  const onDrop = (i: number) => (e: DragEvent) => {
    e.preventDefault();
    if (dragFrom.current !== null) move(dragFrom.current, i);
    dragFrom.current = null;
  };

  return (
    <div className="container-page py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black">{editing ? t('create.editTitle') : t('create.title')}</h1>
          <p className="mt-1 text-sm text-muted" aria-live="polite">
            {editing ? t('create.editingHint') : saved === 'saving' ? t('create.saving') : saved === 'saved' ? t('create.savedLocal') : t('create.draftHint')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setImportOpen(true)}>
            {t('create.import')}
          </Button>
          <Button variant="secondary" onClick={() => setPreview(true)}>
            <IconEye size={18} /> {t('create.preview')}
          </Button>
          <Button onClick={publish} loading={publishing}>
            {editing ? t('create.saveChanges') : t('create.publish')}
          </Button>
        </div>
      </div>

      {showIssues && issues.length ? (
        <div className="mb-6 rounded-card border border-coral/40 bg-coral/10 p-4" role="alert">
          <p className="mb-2 font-bold text-coral">{t('create.fixIssues')}</p>
          <ul className="list-inside list-disc space-y-1 text-sm">
            {issues.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        {/* ---------- Left: quiz details + question list ---------- */}
        <aside className="min-w-0 space-y-6">
          <section className="panel space-y-4 p-5">
            <Field label={t('create.quizTitle')} htmlFor="q-title">
              <input id="q-title" className="field font-bold" maxLength={100} value={draft.title} onChange={(e) => update({ title: e.target.value })} placeholder={t('create.quizTitlePlaceholder')} />
            </Field>
            <Field label={t('create.description')} htmlFor="q-desc">
              <textarea id="q-desc" className="field min-h-[80px]" maxLength={500} value={draft.description} onChange={(e) => update({ description: e.target.value })} />
            </Field>
            <Select label={t('create.category')} value={draft.category} onChange={(e) => update({ category: e.target.value as CategorySlug })}>
              {CATEGORY_SLUGS.map((c) => (
                <option key={c} value={c}>
                  {t(`categories.${c}`)}
                </option>
              ))}
            </Select>
            <div className="grid grid-cols-2 gap-3">
              <Select label={t('create.language')} value={draft.language} onChange={(e) => update({ language: e.target.value as Lang })}>
                {LANGS.map((l) => (
                  <option key={l} value={l}>
                    {t(`languages.${l}`)}
                  </option>
                ))}
              </Select>
              <Select label={t('create.difficulty')} value={draft.difficulty} onChange={(e) => update({ difficulty: e.target.value as Difficulty })}>
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {t(`difficulty.${d}`)}
                  </option>
                ))}
              </Select>
            </div>
            <Select label={t('create.visibility')} value={draft.visibility} onChange={(e) => update({ visibility: e.target.value as 'public' | 'unlisted' })}>
              <option value="public">{t('create.public')}</option>
              <option value="unlisted">{t('create.unlisted')}</option>
            </Select>
            <div>
              <label className="label" htmlFor="q-tags">
                {t('create.tags')}
              </label>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {draft.tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-line/[0.07] py-1 pl-2.5 pr-1 text-xs font-bold">
                    #{tag}
                    <button type="button" onClick={() => update({ tags: draft.tags.filter((x) => x !== tag) })} className="rounded-full p-0.5 hover:bg-line/10" aria-label={t('common.remove')}>
                      <IconX size={12} />
                    </button>
                  </span>
                ))}
              </div>
              <input
                id="q-tags"
                className="field"
                value={tagInput}
                maxLength={24}
                disabled={draft.tags.length >= 5}
                placeholder={t('create.tagsPlaceholder')}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
                    e.preventDefault();
                    const tag = tagInput.trim().replace(/^#/, '');
                    if (!draft.tags.includes(tag) && draft.tags.length < 5) update({ tags: [...draft.tags, tag] });
                    setTagInput('');
                  }
                }}
              />
            </div>
            <div>
              <p className="label">{t('create.cover')}</p>
              {draft.cover ? (
                <div className="relative">
                  <img src={assetUrl(draft.cover)} alt="" className="h-28 w-full rounded-btn object-cover" />
                  <button type="button" onClick={() => update({ cover: null })} className="absolute right-2 top-2 rounded-full bg-navy-950/70 p-1.5 text-white" aria-label={t('common.remove')}>
                    <IconX size={14} />
                  </button>
                </div>
              ) : (
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-btn border border-dashed border-line/25 py-4 text-sm font-semibold text-muted hover:border-cyan hover:text-ink">
                  <IconImage size={18} /> {t('create.uploadImage')}
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => void onUpload(e.target.files?.[0], (url) => update({ cover: url }))} />
                </label>
              )}
            </div>
          </section>

          <section className="panel p-3">
            <div className="mb-2 flex items-center justify-between px-2 pt-1">
              <h2 className="font-bold">{t('create.questions', { count: draft.questions.length })}</h2>
              <span className="text-xs text-muted">
                {draft.questions.length}/{QUIZ_MAX_QUESTIONS}
              </span>
            </div>
            <ol className="space-y-1.5">
              {draft.questions.map((qq, i) => {
                const ok = questionSchema.safeParse(toPayload({ ...draft, questions: [qq] }).questions[0]).success;
                return (
                  <li key={qq.id} draggable onDragStart={onDragStart(i)} onDragOver={(e) => e.preventDefault()} onDrop={onDrop(i)}>
                    <button
                      type="button"
                      onClick={() => setActive(i)}
                      aria-current={i === qi}
                      className={`flex w-full items-center gap-2 rounded-btn px-2 py-2.5 text-left text-sm transition ${i === qi ? 'bg-cyan/15 ring-1 ring-cyan/50' : 'hover:bg-line/5'}`}
                    >
                      <IconGrip size={16} className="shrink-0 cursor-grab text-muted" />
                      <span className="w-5 shrink-0 font-display font-bold text-muted">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate font-semibold">{qq.text || t('create.untitledQuestion')}</span>
                      <span className={`h-2 w-2 shrink-0 rounded-full ${ok ? 'bg-emerald-500' : 'bg-coral'}`} aria-label={ok ? t('create.questionReady') : t('create.questionIncomplete')} />
                    </button>
                  </li>
                );
              })}
            </ol>
            <div className="mt-3 grid grid-cols-1 gap-2">
              <Button variant="secondary" size="sm" onClick={() => addQuestion('single')} disabled={draft.questions.length >= QUIZ_MAX_QUESTIONS}>
                <IconPlus size={16} /> {t('create.addChoice')}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => addQuestion('boolean')} disabled={draft.questions.length >= QUIZ_MAX_QUESTIONS}>
                <IconPlus size={16} /> {t('create.addTrueFalse')}
              </Button>
            </div>
            <p className="mt-3 px-2 text-xs text-muted">{t('create.shortcuts')}</p>
          </section>
        </aside>

        {/* ---------- Right: question editor ---------- */}
        <section className="panel min-w-0 space-y-5 p-5 sm:p-7" aria-label={t('create.questionN', { n: qi + 1 })}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold">{t('create.questionN', { n: qi + 1 })}</h2>
            <div className="flex gap-1">
              <IconBtn label={t('create.moveUp')} onClick={() => move(qi, qi - 1)} disabled={qi === 0}>
                <IconUp size={18} />
              </IconBtn>
              <IconBtn label={t('create.moveDown')} onClick={() => move(qi, qi + 1)} disabled={qi === draft.questions.length - 1}>
                <IconDown size={18} />
              </IconBtn>
              <IconBtn label={t('create.duplicate')} onClick={() => duplicate(qi)}>
                <IconDuplicate size={18} />
              </IconBtn>
              <IconBtn label={t('common.delete')} onClick={() => remove(qi)} disabled={draft.questions.length <= 1}>
                <IconTrash size={18} />
              </IconBtn>
            </div>
          </div>

          <div className="flex rounded-btn border border-line/15 p-1" role="radiogroup" aria-label={t('create.questionType')}>
            {(['single', 'boolean'] as const).map((type) => (
              <button
                key={type}
                type="button"
                role="radio"
                aria-checked={q.type === type}
                onClick={() => {
                  if (q.type === type) return;
                  const fresh = newQuestion(type, draft.language);
                  updateQ(qi, { type, options: fresh.options });
                }}
                className={`flex-1 rounded-[10px] py-2 text-sm font-bold transition ${q.type === type ? 'bg-ink text-bg' : 'text-muted'}`}
              >
                {t(`create.type.${type}`)}
              </button>
            ))}
          </div>

          <Field label={t('create.questionText')} htmlFor="q-text">
            <textarea id="q-text" className="field min-h-[96px] text-lg font-semibold" maxLength={300} value={q.text} onChange={(e) => updateQ(qi, { text: e.target.value })} placeholder={t('create.questionPlaceholder')} />
          </Field>

          <div>
            {q.image ? (
              <div className="relative inline-block">
                <img src={assetUrl(q.image)} alt="" className="max-h-48 rounded-btn" />
                <button type="button" onClick={() => updateQ(qi, { image: null })} className="absolute right-2 top-2 rounded-full bg-navy-950/70 p-1.5 text-white" aria-label={t('common.remove')}>
                  <IconX size={14} />
                </button>
              </div>
            ) : (
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-btn border border-dashed border-line/25 px-4 py-2.5 text-sm font-semibold text-muted hover:border-cyan hover:text-ink">
                <IconImage size={18} /> {t('create.addImage')}
                <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => void onUpload(e.target.files?.[0], (url) => updateQ(qi, { image: url }))} />
              </label>
            )}
          </div>

          <fieldset>
            <legend className="label">{t('create.answers')}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {q.options.map((o, oi) => (
                <div key={oi} className={`flex min-w-0 items-center gap-2 rounded-card border-2 p-2 transition ${o.correct ? 'border-emerald-500 bg-emerald-500/10' : 'border-line/10'}`}>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: ['#FF6B6B', '#4F7BFF', '#F5B731', '#1FBF8F'][oi] }}>
                    <AnswerShape index={oi} size={20} color="#fff" />
                  </span>
                  <input
                    className="w-0 min-w-0 flex-1 bg-transparent px-1 py-2 font-semibold outline-none placeholder:text-muted/60"
                    value={o.text}
                    maxLength={120}
                    readOnly={q.type === 'boolean'}
                    placeholder={oi < 2 ? t('create.answerPlaceholder', { n: oi + 1 }) : t('create.optionalAnswer')}
                    onChange={(e) => updateQ(qi, { options: q.options.map((x, j) => (j === oi ? { ...x, text: e.target.value } : x)) })}
                    aria-label={t('create.answerN', { n: oi + 1 })}
                  />
                  <label className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-2 py-1 text-xs font-bold text-muted">
                    <input
                      type="radio"
                      name={`correct-${q.id}`}
                      checked={o.correct}
                      onChange={() => updateQ(qi, { options: q.options.map((x, j) => ({ ...x, correct: j === oi })) })}
                      className="h-4 w-4 accent-emerald-500"
                    />
                    {t('create.correct')}
                  </label>
                </div>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <Select label={t('create.timeLimit')} value={q.timeLimit} onChange={(e) => updateQ(qi, { timeLimit: Number(e.target.value) })}>
              {TIME_LIMITS.map((s) => (
                <option key={s} value={s}>
                  {t('create.seconds', { count: s })}
                </option>
              ))}
            </Select>
            <Select label={t('create.points')} value={q.points} onChange={(e) => updateQ(qi, { points: e.target.value as PointMode })}>
              {POINT_MODES.map((p) => (
                <option key={p} value={p}>
                  {t(`create.pointModes.${p}`)}
                </option>
              ))}
            </Select>
          </div>
          <Field label={t('create.explanation')} hint={t('create.explanationHint')} htmlFor="q-expl">
            <textarea id="q-expl" className="field min-h-[70px]" maxLength={300} value={q.explanation} onChange={(e) => updateQ(qi, { explanation: e.target.value })} />
          </Field>

          {editing ? (
            <div className="border-t border-line/10 pt-5">
              <Button variant="danger" size="sm" onClick={deleteQuiz}>
                <IconTrash size={16} /> {t('create.deleteQuiz')}
              </Button>
            </div>
          ) : null}
        </section>
      </div>

      <PreviewModal open={preview} onClose={() => setPreview(false)} draft={draft} />
      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={(qs) => {
          setDraft((d) => {
            if (!d) return d;
            const existing = d.questions.filter((x) => x.text.trim());
            return { ...d, questions: [...existing, ...qs].slice(0, QUIZ_MAX_QUESTIONS) };
          });
          toast.success(t('create.imported', { count: qs.length }));
        }}
      />
      <PublishedModal data={published} onClose={() => navigate(published ? `/quizzes/${published.slug}` : '/quizzes')} />
    </div>
  );
}

function IconBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label} className="grid h-9 w-9 place-items-center rounded-btn text-muted transition hover:bg-line/5 hover:text-ink disabled:opacity-30">
      {children}
    </button>
  );
}

function PreviewModal({ open, onClose, draft }: { open: boolean; onClose: () => void; draft: Draft }) {
  const { t } = useTranslation();
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  useEffect(() => {
    setPicked(null);
  }, [i, open]);
  const q = draft.questions[Math.min(i, draft.questions.length - 1)];
  if (!q) return null;
  const opts = toPayload({ ...draft, questions: [q] }).questions[0].options;
  return (
    <Modal open={open} onClose={onClose} title={t('create.previewTitle')} wide>
      <div className="space-y-5">
        <QuestionHeader index={i} total={draft.questions.length} text={q.text || t('create.untitledQuestion')} image={q.image} points={q.points} />
        <AnswerGrid options={opts} picked={picked} correct={picked !== null ? opts.findIndex((o) => o.correct) : null} onPick={picked === null ? setPicked : undefined} />
        {picked !== null && q.explanation ? <p className="text-center text-sm">💡 {q.explanation}</p> : null}
        <div className="flex justify-between">
          <Button variant="secondary" size="sm" disabled={i === 0} onClick={() => setI(i - 1)}>
            {t('common.back')}
          </Button>
          <Button size="sm" disabled={i >= draft.questions.length - 1} onClick={() => setI(i + 1)}>
            {t('common.next')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

const importSchema = z.union([z.array(questionSchema), z.object({ questions: z.array(questionSchema) }).passthrough()]);

function ImportModal({ open, onClose, onImport }: { open: boolean; onClose: () => void; onImport: (qs: DraftQuestion[]) => void }) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const example = `[
  {
    "type": "single",
    "text": "2 + 2 = ?",
    "options": [
      { "text": "3", "correct": false },
      { "text": "4", "correct": true }
    ],
    "timeLimit": 20,
    "points": "standard"
  }
]`;
  const run = () => {
    try {
      const parsed = importSchema.safeParse(JSON.parse(text));
      if (!parsed.success) {
        setError(t('create.importInvalid'));
        return;
      }
      const list = Array.isArray(parsed.data) ? parsed.data : parsed.data.questions;
      onImport(list.map((q) => ({ ...q, id: uid(), image: q.image ?? null, explanation: q.explanation ?? '' })));
      setText('');
      setError(null);
      onClose();
    } catch {
      setError(t('create.importInvalidJson'));
    }
  };
  return (
    <Modal open={open} onClose={onClose} title={t('create.importTitle')} wide>
      <p className="mb-3 text-sm text-muted">{t('create.importText')}</p>
      <textarea className="field min-h-[220px] font-mono text-sm" value={text} onChange={(e) => setText(e.target.value)} placeholder={example} aria-label={t('create.importTitle')} spellCheck={false} />
      {error ? (
        <p className="mt-2 text-sm font-semibold text-coral" role="alert">
          {error}
        </p>
      ) : null}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={() => setText(example)}>
          {t('create.importExample')}
        </Button>
        <Button onClick={run} disabled={!text.trim()}>
          {t('create.importButton')}
        </Button>
      </div>
    </Modal>
  );
}

function PublishedModal({ data, onClose }: { data: { slug: string; editKey?: string; id: string } | null; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  if (!data) return null;
  const link = absoluteUrl(`/quizzes/${data.slug}`);
  return (
    <Modal open={!!data} onClose={onClose} title={t('create.publishedTitle')}>
      <div className="space-y-5">
        <p className="text-muted">{t('create.publishedText')}</p>
        <CopyRow label={t('create.publicLink')} value={link} onCopied={() => toast.success(t('common.linkCopied'))} />
        {data.editKey ? (
          <div className="rounded-card border border-amber-400/40 bg-amber-400/10 p-4">
            <CopyRow label={t('create.editKey')} value={data.editKey} onCopied={() => toast.success(t('common.copied'))} mono />
            <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">{t('create.editKeyWarning')}</p>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button onClick={onClose}>{t('create.openQuiz')}</Button>
          <a href="/create" className="inline-flex items-center px-3 text-sm font-bold text-muted hover:text-ink">
            {t('create.createAnother')}
          </a>
        </div>
      </div>
    </Modal>
  );
}

function CopyRow({ label, value, onCopied, mono }: { label: string; value: string; onCopied: () => void; mono?: boolean }) {
  return (
    <div>
      <p className="label">{label}</p>
      <div className="flex gap-2">
        <input readOnly value={value} className={`field ${mono ? 'font-mono text-sm' : ''}`} onFocus={(e) => e.target.select()} aria-label={label} />
        <Button
          variant="secondary"
          aria-label={label}
          onClick={async () => {
            if (await copyText(value)) onCopied();
          }}
        >
          <IconCopy size={18} />
        </Button>
      </div>
    </div>
  );
}

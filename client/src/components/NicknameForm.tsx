import { useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { AVATAR_COLORS, AVATAR_COUNT, nicknameSchema } from '@uzuz/shared';
import { Avatar } from './Avatar';
import { Button } from './ui';
import { randomNickname } from '../lib/nickname';
import { useSession } from '../context/SessionContext';

export interface NicknameValue {
  nickname: string;
  avatar: number;
  color: number;
}

/** Nickname + optional avatar — the only thing UZUZ ever asks a player for. */
export function NicknameForm({
  onSubmit,
  submitLabel,
  busy,
  serverError,
  suggestion
}: {
  onSubmit: (v: NicknameValue) => void;
  submitLabel: string;
  busy?: boolean;
  serverError?: string | null;
  suggestion?: string | null;
}) {
  const { t } = useTranslation();
  const { profile, session } = useSession();
  const [nickname, setNickname] = useState(profile?.nickname ?? session?.nickname ?? randomNickname());
  const [avatar, setAvatar] = useState(profile?.avatar ?? session?.avatar ?? 0);
  const [color, setColor] = useState(profile?.color ?? session?.color ?? 0);
  const [showPicker, setShowPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = useId();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = nicknameSchema.safeParse(nickname);
    if (!parsed.success) {
      setError(t('errors.NICKNAME_INVALID'));
      return;
    }
    setError(null);
    onSubmit({ nickname: parsed.data, avatar, color });
  };

  const shownError = error ?? serverError;

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => setShowPicker((v) => !v)}
          className="relative rounded-full transition hover:scale-105"
          aria-expanded={showPicker}
          aria-controls={`${id}-picker`}
          aria-label={t('nickname.chooseAvatar')}
        >
          <Avatar avatar={avatar} color={color} size={72} />
          <span className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-cyan text-xs font-black text-navy-950 shadow">✎</span>
        </button>
        <div className="flex-1">
          <label htmlFor={`${id}-nick`} className="label">
            {t('nickname.label')}
          </label>
          <div className="flex gap-2">
            <input
              id={`${id}-nick`}
              className="field text-lg font-bold"
              value={nickname}
              maxLength={20}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              onChange={(e) => setNickname(e.target.value)}
              aria-invalid={!!shownError}
              aria-describedby={`${id}-hint`}
            />
            <button
              type="button"
              onClick={() => setNickname(randomNickname())}
              className="grid w-12 shrink-0 place-items-center rounded-btn border border-line/15 bg-surface-2/70 text-xl transition hover:rotate-12"
              aria-label={t('nickname.random')}
              title={t('nickname.random')}
            >
              🎲
            </button>
          </div>
        </div>
      </div>

      {showPicker ? (
        <div id={`${id}-picker`} className="rounded-card border border-line/10 bg-surface-2/50 p-4">
          <div className="mb-3 flex flex-wrap gap-2" role="radiogroup" aria-label={t('nickname.color')}>
            {AVATAR_COLORS.map((c, i) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={color === i}
                aria-label={`${t('nickname.color')} ${i + 1}`}
                onClick={() => setColor(i)}
                className={`h-8 w-8 rounded-full transition ${color === i ? 'scale-110 ring-2 ring-ink ring-offset-2 ring-offset-bg' : ''}`}
                style={{ background: c }}
              />
            ))}
          </div>
          <div className="grid grid-cols-6 gap-2 sm:grid-cols-8" role="radiogroup" aria-label={t('nickname.chooseAvatar')}>
            {Array.from({ length: AVATAR_COUNT }).map((_, i) => (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={avatar === i}
                aria-label={`${t('nickname.avatar')} ${i + 1}`}
                onClick={() => setAvatar(i)}
                className={`grid place-items-center rounded-2xl p-1 transition ${avatar === i ? 'bg-cyan/20 ring-2 ring-cyan' : 'hover:bg-line/5'}`}
              >
                <Avatar avatar={i} color={color} size={40} />
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div id={`${id}-hint`}>
        {shownError ? (
          <p className="text-sm font-semibold text-coral" role="alert">
            {shownError}
            {suggestion ? (
              <>
                {' '}
                <button type="button" className="underline decoration-2 underline-offset-2" onClick={() => setNickname(suggestion)}>
                  {t('nickname.useSuggestion', { name: suggestion })}
                </button>
              </>
            ) : null}
          </p>
        ) : (
          <p className="text-sm text-muted">{t('nickname.rules')}</p>
        )}
      </div>

      <Button type="submit" size="lg" className="w-full" loading={busy}>
        {submitLabel}
      </Button>
      <p className="text-xs leading-relaxed text-muted">{t('nickname.guestNote')}</p>
    </form>
  );
}

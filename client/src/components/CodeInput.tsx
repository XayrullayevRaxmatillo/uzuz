import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '@uzuz/shared';

const ALLOWED = new Set(ROOM_CODE_ALPHABET.split(''));

/** Six separate boxes for the room code; accepts paste, ignores ambiguous characters. */
export function CodeInput({
  value,
  onChange,
  onComplete,
  size = 'lg',
  autoFocus,
  invalid
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  size?: 'md' | 'lg';
  autoFocus?: boolean;
  invalid?: boolean;
}) {
  const { t } = useTranslation();
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const chars = value.padEnd(ROOM_CODE_LENGTH, ' ').slice(0, ROOM_CODE_LENGTH).split('');

  const clean = (s: string) =>
    s
      .toUpperCase()
      .split('')
      .filter((c) => ALLOWED.has(c))
      .join('');

  const setAt = (i: number, ch: string) => {
    const arr = value.padEnd(ROOM_CODE_LENGTH, ' ').slice(0, ROOM_CODE_LENGTH).split('');
    arr[i] = ch;
    const next = arr.join('').replace(/\s+$/g, '').replace(/ /g, '');
    onChange(next);
    if (next.length === ROOM_CODE_LENGTH) onComplete?.(next);
  };

  const onInput = (i: number, raw: string) => {
    let c = clean(raw);
    if (!c) return;
    // Typing into an already-filled box yields "old+new" — keep only the new character.
    const prev = chars[i].trim();
    if (prev && c.length === 2 && (c[0] === prev || c[1] === prev)) c = c[0] === prev ? c[1] : c[0];
    if (c.length > 1) {
      const merged = (value.slice(0, i) + c).slice(0, ROOM_CODE_LENGTH);
      onChange(merged);
      refs.current[Math.min(merged.length, ROOM_CODE_LENGTH - 1)]?.focus();
      if (merged.length === ROOM_CODE_LENGTH) onComplete?.(merged);
      return;
    }
    setAt(i, c);
    refs.current[i + 1]?.focus();
  };

  const onKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (value[i]) {
        onChange(value.slice(0, i) + value.slice(i + 1));
      } else if (i > 0) {
        onChange(value.slice(0, i - 1) + value.slice(i));
        refs.current[i - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus();
    else if (e.key === 'ArrowRight' && i < ROOM_CODE_LENGTH - 1) refs.current[i + 1]?.focus();
    else if (e.key === 'Enter' && value.length === ROOM_CODE_LENGTH) onComplete?.(value);
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const c = clean(e.clipboardData.getData('text')).slice(0, ROOM_CODE_LENGTH);
    if (!c) return;
    onChange(c);
    refs.current[Math.min(c.length, ROOM_CODE_LENGTH - 1)]?.focus();
    if (c.length === ROOM_CODE_LENGTH) onComplete?.(c);
  };

  const box = size === 'lg' ? 'h-16 w-12 text-3xl sm:h-20 sm:w-16 sm:text-4xl' : 'h-12 w-10 text-2xl sm:h-14 sm:w-12';

  return (
    <div className="flex justify-center gap-1.5 sm:gap-2.5" role="group" aria-label={t('join.codeLabel')}>
      {chars.map((ch, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={ch.trim()}
          onChange={(e) => onInput(i, e.target.value.slice(-ROOM_CODE_LENGTH))}
          onKeyDown={(e) => onKey(i, e)}
          onPaste={onPaste}
          onFocus={(e) => e.target.select()}
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={ROOM_CODE_LENGTH}
          autoFocus={autoFocus && i === 0}
          aria-label={t('join.codeChar', { n: i + 1 })}
          aria-invalid={invalid || undefined}
          className={`${box} rounded-2xl border-2 bg-surface/70 text-center font-display font-extrabold uppercase text-ink caret-cyan transition focus:border-cyan focus:outline-none focus:ring-4 focus:ring-cyan/25 ${
            invalid ? 'border-coral' : ch.trim() ? 'border-violet/60' : 'border-line/15'
          }`}
        />
      ))}
    </div>
  );
}

import { ANSWER_STYLES } from '@uzuz/shared';

export type ShapeKind = 'diamond' | 'circle' | 'triangle' | 'square';

/** The four UZUZ answer shapes — the brand's core motif. Slightly soft corners for a friendly feel. */
export function Shape({ kind, size = 24, color = 'currentColor', className = '' }: { kind: ShapeKind; size?: number; color?: string; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      {kind === 'diamond' && <path d="M12 1.8 22.2 12 12 22.2 1.8 12z" fill={color} stroke={color} strokeWidth="1.6" strokeLinejoin="round" />}
      {kind === 'circle' && <circle cx="12" cy="12" r="10" fill={color} />}
      {kind === 'triangle' && <path d="M12 2.6 22 20.6H2z" fill={color} stroke={color} strokeWidth="1.8" strokeLinejoin="round" />}
      {kind === 'square' && <rect x="2.6" y="2.6" width="18.8" height="18.8" rx="3.5" fill={color} />}
    </svg>
  );
}

export function AnswerShape({ index, size = 24, className = '', color }: { index: number; size?: number; className?: string; color?: string }) {
  const s = ANSWER_STYLES[index % 4];
  return <Shape kind={s.shape as ShapeKind} size={size} color={color ?? s.color} className={className} />;
}

/** Four shapes in a row: used as a loader and a small brand mark. */
export function ShapeRow({ size = 14, animate = false, className = '' }: { size?: number; animate?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`} aria-hidden="true">
      {ANSWER_STYLES.map((s, i) => (
        <span key={s.key} className={animate ? 'animate-bounce' : ''} style={animate ? { animationDelay: `${i * 0.12}s`, animationDuration: '1s' } : undefined}>
          <Shape kind={s.shape as ShapeKind} size={size} color={s.color} />
        </span>
      ))}
    </span>
  );
}

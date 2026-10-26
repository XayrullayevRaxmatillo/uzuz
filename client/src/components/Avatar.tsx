import { AVATAR_COLORS, AVATAR_COUNT } from '@uzuz/shared';

/**
 * 24 original avatars = 6 body shapes × 4 faces. Pure SVG, no external art.
 */
const BODIES = [
  // round
  <circle key="b0" cx="32" cy="34" r="24" />,
  // squircle
  <rect key="b1" x="9" y="11" width="46" height="46" rx="16" />,
  // blob
  <path key="b2" d="M32 9c12 0 23 8 23 22s-9 26-23 26S9 47 9 33 20 9 32 9z" />,
  // drop / triangle-ish
  <path key="b3" d="M32 7c6 9 24 26 24 34a24 24 0 0 1-48 0c0-8 18-25 24-34z" />,
  // hexagon
  <path key="b4" d="M32 8 53 20v26L32 58 11 46V20z" />,
  // flower
  <path key="b5" d="M32 8a10 10 0 0 1 9.4 6.6A10 10 0 0 1 54 26a10 10 0 0 1-2.6 10.6A10 10 0 0 1 44 52a10 10 0 0 1-12 4 10 10 0 0 1-12-4 10 10 0 0 1-7.4-15.4A10 10 0 0 1 10 26a10 10 0 0 1 12.6-11.4A10 10 0 0 1 32 8z" />
];

function Face({ variant }: { variant: number }) {
  const eye = '#10153A';
  switch (variant) {
    case 0: // happy
      return (
        <g>
          <circle cx="24" cy="31" r="3.4" fill={eye} />
          <circle cx="40" cy="31" r="3.4" fill={eye} />
          <path d="M24 40c4 5 12 5 16 0" stroke={eye} strokeWidth="3" fill="none" strokeLinecap="round" />
        </g>
      );
    case 1: // big eyes
      return (
        <g>
          <circle cx="24" cy="31" r="6" fill="#fff" />
          <circle cx="40" cy="31" r="6" fill="#fff" />
          <circle cx="25.5" cy="32" r="3" fill={eye} />
          <circle cx="41.5" cy="32" r="3" fill={eye} />
          <ellipse cx="32" cy="43" rx="4" ry="2.6" fill={eye} />
        </g>
      );
    case 2: // calm
      return (
        <g>
          <path d="M20 31c2.5-3 6.5-3 9 0M35 31c2.5-3 6.5-3 9 0" stroke={eye} strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M27 41h10" stroke={eye} strokeWidth="3" strokeLinecap="round" />
          <circle cx="19" cy="38" r="3" fill="#FF6B6B" opacity=".45" />
          <circle cx="45" cy="38" r="3" fill="#FF6B6B" opacity=".45" />
        </g>
      );
    default: // wink + grin
      return (
        <g>
          <circle cx="24" cy="31" r="3.4" fill={eye} />
          <path d="M36 31h8" stroke={eye} strokeWidth="3" strokeLinecap="round" />
          <path d="M23 39h18a9 9 0 0 1-18 0z" fill={eye} />
        </g>
      );
  }
}

export function Avatar({
  avatar,
  color,
  size = 40,
  className = '',
  ring = false,
  title
}: {
  avatar: number;
  color: number;
  size?: number;
  className?: string;
  ring?: boolean;
  title?: string;
}) {
  const a = ((avatar % AVATAR_COUNT) + AVATAR_COUNT) % AVATAR_COUNT;
  const fill = AVATAR_COLORS[((color % AVATAR_COLORS.length) + AVATAR_COLORS.length) % AVATAR_COLORS.length];
  const body = BODIES[a % BODIES.length];
  const face = Math.floor(a / BODIES.length) % 4;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={`shrink-0 ${ring ? 'rounded-full ring-2 ring-white/70 ring-offset-2 ring-offset-bg' : ''} ${className}`}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <g fill={fill}>{body}</g>
      <g fill="#ffffff" opacity="0.18">
        <ellipse cx="24" cy="20" rx="9" ry="5" />
      </g>
      <Face variant={face} />
    </svg>
  );
}

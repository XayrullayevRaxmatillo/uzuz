/**
 * UZUZ mark: a violet tile split by a cyan "Z" bolt, with the second "UZ" mirrored —
 * read as two letterforms meeting in a spark.
 */
export function LogoMark({ size = 36, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="uzuz-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#4F46E5" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="44" height="44" rx="13" fill="url(#uzuz-g)" />
      {/* U */}
      <path d="M11 12v11a6 6 0 0 0 12 0V12" fill="none" stroke="#fff" strokeWidth="4.2" strokeLinecap="round" />
      {/* Z bolt */}
      <path d="M26 25h11l-11 11h11" fill="none" stroke="#22D3EE" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="37.5" cy="13.5" r="3.2" fill="#FF6B6B" />
    </svg>
  );
}

export function Logo({ className = '', size = 34 }: { className?: string; size?: number }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      <span className="font-display text-[1.35rem] font-extrabold tracking-tight">
        UZ<span className="text-cyan">UZ</span>
      </span>
    </span>
  );
}

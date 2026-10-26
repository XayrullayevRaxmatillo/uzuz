import { useEffect, useRef, useState } from 'react';
import { animate, motion, useReducedMotion } from 'motion/react';
import { serverNow } from '../../lib/socket';
import { formatNumber } from '../../i18n';
import { sfx } from '../../lib/sound';
import { useSettings } from '../../context/SettingsContext';

/** Seconds remaining until a server timestamp; re-renders ~10×/s. */
export function useCountdown(endsAt: number | null | undefined): number {
  const [now, setNow] = useState(serverNow());
  useEffect(() => {
    if (!endsAt) return;
    const id = window.setInterval(() => setNow(serverNow()), 100);
    return () => window.clearInterval(id);
  }, [endsAt]);
  if (!endsAt) return 0;
  return Math.max(0, endsAt - now);
}

/** Animated circular timer driven by the server's endsAt. */
export function CircularTimer({ endsAt, totalMs, size = 96, label }: { endsAt: number; totalMs: number; size?: number; label: string }) {
  const remaining = useCountdown(endsAt);
  const seconds = Math.ceil(remaining / 1000);
  const ratio = totalMs > 0 ? remaining / totalMs : 0;
  const r = 42;
  const c = 2 * Math.PI * r;
  const danger = seconds <= 5;
  const lastSec = useRef(seconds);

  useEffect(() => {
    if (seconds !== lastSec.current && seconds <= 3 && seconds > 0) sfx.tick();
    lastSec.current = seconds;
  }, [seconds]);

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }} role="timer" aria-label={label}>
      <svg width={size} height={size} viewBox="0 0 100 100" className="-rotate-90">
        <circle cx="50" cy="50" r={r} stroke="rgb(var(--line) / 0.12)" strokeWidth="9" fill="none" />
        <circle
          cx="50"
          cy="50"
          r={r}
          stroke={danger ? '#FF6B6B' : '#22D3EE'}
          strokeWidth="9"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - ratio)}
          style={{ transition: 'stroke-dashoffset 0.1s linear, stroke 0.3s' }}
        />
      </svg>
      <span className={`absolute font-display font-extrabold tabular-nums ${danger ? 'text-coral' : ''}`} style={{ fontSize: size * 0.34 }} aria-hidden="true">
        {seconds}
      </span>
      {/* Screen readers: announce only at a few moments */}
      <span className="sr-only" aria-live="polite">
        {seconds === 10 || seconds === 5 ? label : ''}
      </span>
    </div>
  );
}

/** Number that counts up to its value. */
export function CountUp({ value, className = '', duration = 0.9 }: { value: number; className?: string; duration?: number }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  const reduced = useReducedMotion();
  const { motionReduced } = useSettings();
  useEffect(() => {
    if (reduced || motionReduced) {
      setDisplay(value);
      prev.current = value;
      return;
    }
    const controls = animate(prev.current, value, {
      duration,
      ease: 'easeOut',
      onUpdate: (v) => setDisplay(Math.round(v))
    });
    prev.current = value;
    return () => controls.stop();
  }, [value, duration, reduced, motionReduced]);
  return <span className={`tabular-nums ${className}`}>{formatNumber(display)}</span>;
}

/** Big 3-2-1 before each question. */
export function CountdownOverlay({ endsAt, label }: { endsAt: number; label: string }) {
  const remaining = useCountdown(endsAt);
  const n = Math.max(1, Math.ceil(remaining / 1000));
  const last = useRef(n);
  useEffect(() => {
    if (n !== last.current) {
      sfx.tick();
      last.current = n;
    }
  }, [n]);
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-16" role="status" aria-live="assertive">
      <p className="text-lg font-bold text-muted">{label}</p>
      <motion.div
        key={n}
        initial={{ scale: 1.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 18 }}
        className="grid h-40 w-40 place-items-center rounded-full brand-gradient font-display text-7xl font-black text-white shadow-glow"
      >
        {n}
      </motion.div>
    </div>
  );
}

/** Lightweight canvas confetti. Disabled entirely with reduced motion. */
export function Confetti({ run }: { run: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  const { motionReduced } = useSettings();

  useEffect(() => {
    if (!run || reduced || motionReduced) return;
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
    };
    resize();
    window.addEventListener('resize', resize);
    const colors = ['#FF6B6B', '#4F7BFF', '#F5B731', '#1FBF8F', '#22D3EE', '#A78BFA'];
    const parts = Array.from({ length: 160 }, () => ({
      x: Math.random() * canvas.width,
      y: -Math.random() * canvas.height * 0.6,
      vx: (Math.random() - 0.5) * 3 * dpr,
      vy: (2 + Math.random() * 4) * dpr,
      size: (6 + Math.random() * 8) * dpr,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.25,
      color: colors[Math.floor(Math.random() * colors.length)],
      shape: Math.floor(Math.random() * 3)
    }));
    let frame = 0;
    let raf = 0;
    const tick = () => {
      frame++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of parts) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.04 * dpr;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, 1 - frame / 260);
        if (p.shape === 0) ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        else if (p.shape === 1) {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 3, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.moveTo(0, -p.size / 2);
          ctx.lineTo(p.size / 2, p.size / 2);
          ctx.lineTo(-p.size / 2, p.size / 2);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }
      if (frame < 260) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [run, reduced, motionReduced]);

  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-[80] h-full w-full" aria-hidden="true" />;
}

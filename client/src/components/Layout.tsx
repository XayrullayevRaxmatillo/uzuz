import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useOutlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'motion/react';
import { LANGS, type Lang } from '@uzuz/shared';
import { Logo } from './Logo';
import { Avatar } from './Avatar';
import { Modal, PageLoader, Toggle } from './ui';
import { IconGrid, IconHome, IconKey, IconMenu, IconMoon, IconPlus, IconSun, IconTrophy, IconUsers, IconUser, IconVolume } from './icons';
import { useSettings } from '../context/SettingsContext';
import { useSession } from '../context/SessionContext';
import { useToast } from '../context/ToastContext';
import { getSocket } from '../lib/socket';

const NAV = [
  { to: '/', key: 'nav.home', icon: IconHome, end: true },
  { to: '/quizzes', key: 'nav.quizzes', icon: IconGrid },
  { to: '/teams', key: 'nav.teams', icon: IconUsers },
  { to: '/join', key: 'nav.join', icon: IconKey },
  { to: '/create', key: 'nav.create', icon: IconPlus },
  { to: '/leaderboard', key: 'nav.leaderboard', icon: IconTrophy }
] as const;

const MOBILE_TABS = ['/', '/quizzes', '/join', '/teams', '/leaderboard'];

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { i18n, t } = useTranslation();
  return (
    <div role="group" aria-label={t('settings.language')} className="inline-flex rounded-full border border-line/15 bg-surface/50 p-1">
      {LANGS.map((l: Lang) => (
        <button
          key={l}
          type="button"
          onClick={() => void i18n.changeLanguage(l)}
          aria-pressed={i18n.language === l}
          className={`rounded-full px-2.5 py-1 text-xs font-extrabold transition ${compact ? '' : 'sm:px-3'} ${
            i18n.language === l ? 'bg-ink text-bg' : 'text-muted hover:text-ink'
          }`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function ThemeToggle() {
  const { theme, toggleTheme } = useSettings();
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="grid h-10 w-10 place-items-center rounded-full border border-line/15 bg-surface/50 text-ink transition hover:border-line/30"
      aria-label={theme === 'dark' ? t('settings.lightMode') : t('settings.darkMode')}
      title={theme === 'dark' ? t('settings.lightMode') : t('settings.darkMode')}
    >
      {theme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
    </button>
  );
}

function ProfileButton() {
  const { session } = useSession();
  const { t } = useTranslation();
  return (
    <Link
      to="/me"
      className="flex h-10 items-center gap-2 rounded-full border border-line/15 bg-surface/50 py-1 pl-1 pr-3 text-sm font-bold transition hover:border-line/30"
      aria-label={t('nav.me')}
    >
      {session ? <Avatar avatar={session.avatar} color={session.color} size={30} /> : <IconUser size={18} className="ml-1.5" />}
      <span className="hidden max-w-[110px] truncate 2xl:inline">{session?.nickname ?? t('nav.me')}</span>
    </Link>
  );
}

function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const s = useSettings();
  return (
    <Modal open={open} onClose={onClose} title={t('settings.title')}>
      <div className="space-y-6">
        <div>
          <p className="label">{t('settings.language')}</p>
          <LanguageSwitcher />
        </div>
        <Toggle checked={s.theme === 'dark'} onChange={() => s.toggleTheme()} label={t('settings.darkMode')} />
        <Toggle checked={s.reduceMotion} onChange={s.setReduceMotion} label={t('settings.reduceMotion')} description={t('settings.reduceMotionHint')} />
        <Toggle checked={s.sound} onChange={s.setSound} label={t('settings.sound')} description={t('settings.soundHint')} />
        <nav className="grid grid-cols-2 gap-2 border-t border-line/10 pt-5 text-sm font-semibold">
          <Link to="/create" onClick={onClose} className="rounded-btn bg-line/5 px-3 py-2.5 hover:bg-line/10">
            {t('nav.create')}
          </Link>
          <Link to="/me" onClick={onClose} className="rounded-btn bg-line/5 px-3 py-2.5 hover:bg-line/10">
            {t('nav.me')}
          </Link>
          <Link to="/about" onClick={onClose} className="rounded-btn bg-line/5 px-3 py-2.5 hover:bg-line/10">
            {t('nav.about')}
          </Link>
          <Link to="/privacy" onClick={onClose} className="rounded-btn bg-line/5 px-3 py-2.5 hover:bg-line/10">
            {t('nav.privacy')}
          </Link>
        </nav>
      </div>
    </Modal>
  );
}

/** Real-time team notifications (join requests / decisions) for this guest session. */
function TeamNotifications() {
  const { session } = useSession();
  const toast = useToast();
  const { t } = useTranslation();
  useEffect(() => {
    if (!session) return;
    const s = getSocket();
    const onReq = (p: { teamName: string; nickname: string }) => toast.info(t('teams.toastRequest', { nickname: p.nickname, team: p.teamName }));
    const onRes = (p: { teamName: string; accepted: boolean }) =>
      p.accepted ? toast.success(t('teams.toastAccepted', { team: p.teamName })) : toast.info(t('teams.toastRejected', { team: p.teamName }));
    s.on('team:request', onReq);
    s.on('team:requestResult', onRes);
    return () => {
      s.off('team:request', onReq);
      s.off('team:requestResult', onRes);
    };
  }, [session, toast, t]);
  return null;
}

export function Layout({ children }: { children?: ReactNode }) {
  const { t } = useTranslation();
  const outlet = useOutlet();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { sound, setSound } = useSettings();
  const location = useLocation();
  const inGame = /^\/room\//.test(location.pathname);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="aurora" aria-hidden="true" />
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-btn focus:bg-cyan focus:px-4 focus:py-2 focus:font-bold focus:text-navy-950">
        {t('common.skipToContent')}
      </a>
      <TeamNotifications />

      <header className="sticky top-0 z-50 border-b border-line/[0.07] bg-bg/75 backdrop-blur-xl">
        <div className="container-page flex h-16 items-center gap-4">
          <Link to="/" className="shrink-0 rounded-btn" aria-label="UZUZ">
            <Logo />
          </Link>
          {!inGame && (
            <nav className="ml-2 hidden items-center gap-0.5 xl:flex" aria-label={t('nav.main')}>
              {NAV.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={'end' in n ? n.end : undefined}
                  className={({ isActive }) =>
                    `whitespace-nowrap rounded-full px-3 py-2 text-sm font-bold transition ${isActive ? 'bg-ink text-bg' : 'text-muted hover:bg-line/5 hover:text-ink'}`
                  }
                >
                  {t(n.key)}
                </NavLink>
              ))}
            </nav>
          )}
          <div className="ml-auto flex items-center gap-2">
            {inGame ? (
              <button
                type="button"
                onClick={() => setSound(!sound)}
                className="grid h-10 w-10 place-items-center rounded-full border border-line/15 bg-surface/50"
                aria-label={sound ? t('settings.soundOff') : t('settings.soundOn')}
                aria-pressed={sound}
              >
                <IconVolume size={18} muted={!sound} />
              </button>
            ) : null}
            <div className="hidden md:block">
              <LanguageSwitcher compact />
            </div>
            <ThemeToggle />
            <ProfileButton />
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="grid h-10 w-10 place-items-center rounded-full border border-line/15 bg-surface/50 xl:hidden"
              aria-label={t('settings.title')}
            >
              <IconMenu size={18} />
            </button>
          </div>
        </div>
      </header>

      <main id="main" className={`flex-1 ${inGame ? '' : 'pb-28 md:pb-12'}`}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            <Suspense fallback={<PageLoader />}>{children ?? outlet}</Suspense>
          </motion.div>
        </AnimatePresence>
      </main>

      {!inGame && (
        <footer className="hidden border-t border-line/[0.07] py-10 md:block">
          <div className="container-page flex flex-wrap items-center justify-between gap-6 text-sm text-muted">
            <div className="flex items-center gap-4">
              <Logo size={26} />
              <span>{t('brand.slogan')}</span>
            </div>
            <nav className="flex flex-wrap items-center gap-5 font-semibold">
              <Link to="/about" className="hover:text-ink">
                {t('nav.about')}
              </Link>
              <Link to="/privacy" className="hover:text-ink">
                {t('nav.privacy')}
              </Link>
              <button type="button" onClick={() => setSettingsOpen(true)} className="hover:text-ink">
                {t('settings.title')}
              </button>
              <span>{t('footer.free')}</span>
            </nav>
          </div>
        </footer>
      )}

      {!inGame && (
        <nav
          className="fixed inset-x-0 bottom-0 z-50 border-t border-line/10 bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
          aria-label={t('nav.main')}
        >
          <div className="grid grid-cols-5">
            {NAV.filter((n) => MOBILE_TABS.includes(n.to)).map((n) => {
              const Icon = n.icon;
              return (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={'end' in n ? n.end : undefined}
                  className={({ isActive }) =>
                    `flex flex-col items-center gap-1 py-2.5 text-[11px] font-bold transition ${isActive ? 'text-cyan-600 dark:text-cyan' : 'text-muted'}`
                  }
                >
                  <Icon size={22} />
                  <span className="max-w-full truncate px-1">{t(`${n.key}Short`)}</span>
                </NavLink>
              );
            })}
          </div>
        </nav>
      )}

      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

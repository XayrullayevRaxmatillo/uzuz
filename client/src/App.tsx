import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Layout } from './components/Layout';
import { PageLoader } from './components/ui';
import Home from './pages/Home';

const Quizzes = lazy(() => import('./pages/Quizzes'));
const QuizDetail = lazy(() => import('./pages/QuizDetail'));
const Join = lazy(() => import('./pages/Join'));
const Host = lazy(() => import('./pages/Host'));
const Play = lazy(() => import('./pages/Play'));
const Results = lazy(() => import('./pages/Results'));
const Create = lazy(() => import('./pages/Create'));
const Teams = lazy(() => import('./pages/Teams'));
const TeamDetail = lazy(() => import('./pages/TeamDetail'));
const Leaderboard = lazy(() => import('./pages/Leaderboard'));
const Me = lazy(() => import('./pages/Me'));
const About = lazy(() => import('./pages/About'));
const Privacy = lazy(() => import('./pages/Privacy'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Admin = lazy(() => import('./pages/admin/Admin'));

export function App() {
  const { t, i18n } = useTranslation();

  useEffect(() => {
    document.title = `UZUZ — ${t('brand.slogan')}`;
  }, [t, i18n.language]);

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Admin is a separate bundle with its own minimal shell */}
        <Route path="/admin/*" element={<Admin />} />
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="quizzes" element={<Quizzes />} />
          <Route path="quizzes/:slug" element={<QuizDetail />} />
          <Route path="join" element={<Join />} />
          <Route path="join/:code" element={<Join />} />
          <Route path="room/:code/host" element={<Host />} />
          <Route path="room/:code/play" element={<Play />} />
          <Route path="room/:code/results" element={<Results />} />
          <Route path="create" element={<Create />} />
          <Route path="edit/:quizId" element={<Create />} />
          <Route path="teams" element={<Teams />} />
          <Route path="teams/:id" element={<TeamDetail />} />
          <Route path="leaderboard" element={<Leaderboard />} />
          <Route path="me" element={<Me />} />
          <Route path="about" element={<About />} />
          <Route path="privacy" element={<Privacy />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

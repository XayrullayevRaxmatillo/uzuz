import { useTranslation } from 'react-i18next';
import { ButtonLink } from '../components/ui';
import { ShapeRow } from '../components/Shape';

export default function About() {
  const { t } = useTranslation();
  const points = t('about.points', { returnObjects: true }) as { title: string; text: string }[];
  return (
    <div className="container-page max-w-3xl py-12">
      <ShapeRow size={20} />
      <h1 className="mt-4 text-4xl font-black">{t('about.title')}</h1>
      <p className="mt-4 text-lg text-muted">{t('about.intro')}</p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {points.map((p) => (
          <div key={p.title} className="panel p-5">
            <h2 className="font-display text-lg font-bold">{p.title}</h2>
            <p className="mt-2 text-muted">{p.text}</p>
          </div>
        ))}
      </div>
      <div className="mt-10 flex flex-wrap gap-3">
        <ButtonLink to="/quizzes">{t('home.ctaPlay')}</ButtonLink>
        <ButtonLink to="/privacy" variant="secondary">
          {t('nav.privacy')}
        </ButtonLink>
      </div>
    </div>
  );
}

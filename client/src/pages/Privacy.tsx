import { useTranslation } from 'react-i18next';

export default function Privacy() {
  const { t } = useTranslation();
  const sections = t('privacy.sections', { returnObjects: true }) as { title: string; text: string }[];
  return (
    <div className="container-page max-w-3xl py-12">
      <h1 className="text-4xl font-black">{t('privacy.title')}</h1>
      <p className="mt-4 text-lg text-muted">{t('privacy.intro')}</p>
      <div className="mt-8 space-y-6">
        {sections.map((s) => (
          <section key={s.title}>
            <h2 className="text-xl font-bold">{s.title}</h2>
            <p className="mt-2 leading-relaxed text-muted">{s.text}</p>
          </section>
        ))}
      </div>
    </div>
  );
}

import { useTranslation } from 'react-i18next';
import { ButtonLink, Center } from '../components/ui';
import { ShapeRow } from '../components/Shape';

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <Center>
      <ShapeRow size={24} />
      <p className="font-display text-7xl font-black text-gradient">404</p>
      <h1 className="text-2xl font-bold">{t('notFound.title')}</h1>
      <p className="max-w-md text-muted">{t('notFound.text')}</p>
      <div className="flex gap-3">
        <ButtonLink to="/">{t('common.home')}</ButtonLink>
        <ButtonLink to="/join" variant="secondary">
          {t('nav.join')}
        </ButtonLink>
      </div>
    </Center>
  );
}

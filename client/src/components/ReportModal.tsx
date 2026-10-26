import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { REPORT_REASONS, type ReportReason } from '@uzuz/shared';
import { Button, Modal } from './ui';
import { api } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { useToast } from '../context/ToastContext';

export function ReportModal({ open, onClose, targetType, targetId }: { open: boolean; onClose: () => void; targetType: 'quiz' | 'team' | 'player'; targetId: string }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [reason, setReason] = useState<ReportReason>('inappropriate');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await api('/reports', { method: 'POST', body: { targetType, targetId, reason, details } });
      toast.success(t('report.sent'));
      onClose();
    } catch (err) {
      toast.error(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t('report.title')}>
      <fieldset className="space-y-2">
        <legend className="label">{t('report.reason')}</legend>
        {REPORT_REASONS.filter((r) => targetType === 'quiz' || r !== 'wrong_answers').map((r) => (
          <label key={r} className={`flex cursor-pointer items-center gap-3 rounded-btn border px-4 py-3 font-semibold ${reason === r ? 'border-cyan bg-cyan/10' : 'border-line/15'}`}>
            <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="accent-cyan-600" />
            {t(`report.reasons.${r}`)}
          </label>
        ))}
      </fieldset>
      <label className="label mt-4" htmlFor="report-details">
        {t('report.details')}
      </label>
      <textarea id="report-details" className="field min-h-[90px]" maxLength={500} value={details} onChange={(e) => setDetails(e.target.value)} />
      <Button className="mt-5 w-full" onClick={submit} loading={busy}>
        {t('report.submit')}
      </Button>
    </Modal>
  );
}

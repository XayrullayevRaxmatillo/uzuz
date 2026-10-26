import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MAX_PLAYERS_LIMIT, TIME_MULTIPLIERS, type RoomMode } from '@uzuz/shared';
import { Button, Modal, Select, Toggle } from './ui';
import { api } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { useToast } from '../context/ToastContext';

export function RoomSettingsModal({ open, onClose, quizId, defaultMode = 'classic' }: { open: boolean; onClose: () => void; quizId: string; defaultMode?: RoomMode }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const [mode, setMode] = useState<RoomMode>(defaultMode === 'solo' ? 'classic' : defaultMode);
  const [isPublic, setIsPublic] = useState(false);
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [shuffleAnswers, setShuffleAnswers] = useState(true);
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [timeMultiplier, setTimeMultiplier] = useState(1);
  const [maxPlayers, setMaxPlayers] = useState(100);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    try {
      const r = await api<{ code: string }>('/rooms', {
        method: 'POST',
        body: { quizId, mode, settings: { isPublic, shuffleQuestions, shuffleAnswers, autoAdvance, timeMultiplier, maxPlayers } }
      });
      navigate(`/room/${r.code}/host`);
    } catch (err) {
      toast.error(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t('host.settingsTitle')}>
      <div className="space-y-5">
        <div>
          <p className="label">{t('host.mode')}</p>
          <div className="grid grid-cols-2 gap-2">
            {(['classic', 'team'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={`rounded-card border p-4 text-left transition ${mode === m ? 'border-cyan bg-cyan/10' : 'border-line/15 hover:border-line/30'}`}
              >
                <span className="block font-bold">{t(`modes.${m}`)}</span>
                <span className="text-sm text-muted">{t(`modes.${m}Hint`)}</span>
              </button>
            ))}
          </div>
        </div>
        <Toggle checked={isPublic} onChange={setIsPublic} label={t('host.publicRoom')} description={t('host.publicRoomHint')} />
        <Toggle checked={shuffleQuestions} onChange={setShuffleQuestions} label={t('host.shuffleQuestions')} />
        <Toggle checked={shuffleAnswers} onChange={setShuffleAnswers} label={t('host.shuffleAnswers')} />
        <Toggle checked={autoAdvance} onChange={setAutoAdvance} label={t('host.autoAdvance')} description={t('host.autoAdvanceHint')} />
        <div className="grid grid-cols-2 gap-3">
          <Select label={t('host.timeMultiplier')} value={timeMultiplier} onChange={(e) => setTimeMultiplier(Number(e.target.value))}>
            {TIME_MULTIPLIERS.map((m) => (
              <option key={m} value={m}>
                ×{m}
              </option>
            ))}
          </Select>
          <div>
            <label className="label" htmlFor="maxPlayers">
              {t('host.maxPlayers')}
            </label>
            <input
              id="maxPlayers"
              type="number"
              min={2}
              max={MAX_PLAYERS_LIMIT}
              className="field"
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(Math.min(MAX_PLAYERS_LIMIT, Math.max(2, Number(e.target.value) || 2)))}
            />
          </div>
        </div>
        <Button size="lg" className="w-full" onClick={create} loading={busy}>
          {t('host.createRoom')}
        </Button>
      </div>
    </Modal>
  );
}

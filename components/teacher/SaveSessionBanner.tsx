import React, { useState, useEffect } from 'react';
import { Save, X, Clock } from 'lucide-react';
import { Button } from '../ui/Button';

interface SaveSessionBannerProps {
  sessionId: string;
  dataExpiresAt: string | null;
  dataPersisted: boolean;
  studentCount: number;
  onPersist: () => Promise<boolean>;
}

export const SaveSessionBanner: React.FC<SaveSessionBannerProps> = ({
  sessionId,
  dataExpiresAt,
  dataPersisted,
  studentCount,
  onPersist,
}) => {
  const [dismissed, setDismissed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(dataPersisted);
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  // Check localStorage for dismissed state
  useEffect(() => {
    const dismissedKey = `session-save-dismissed-${sessionId}`;
    if (localStorage.getItem(dismissedKey)) {
      setDismissed(true);
    }
  }, [sessionId]);

  // Update saved state when prop changes
  useEffect(() => {
    setSaved(dataPersisted);
  }, [dataPersisted]);

  // Update countdown timer
  useEffect(() => {
    if (!dataExpiresAt || saved) return;

    const updateTimer = () => {
      const expires = new Date(dataExpiresAt).getTime();
      const now = Date.now();
      const diff = expires - now;

      if (diff <= 0) {
        setTimeRemaining('expired');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setTimeRemaining(`${hours}h ${minutes}m`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [dataExpiresAt, saved]);

  // Don't show if: no students, already saved, dismissed, or expired
  if (studentCount === 0 || saved || dismissed || timeRemaining === 'expired') {
    return null;
  }

  const handleSave = async () => {
    setSaving(true);
    const success = await onPersist();
    setSaving(false);
    if (success) {
      setSaved(true);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(`session-save-dismissed-${sessionId}`, 'true');
    setDismissed(true);
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
            <Save className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-blue-900">
              Enable permanent storage?
            </p>
            <p className="text-xs text-blue-700 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Temporary data expires in {timeRemaining}. Enable to save all student work permanently.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="primary"
            onClick={handleSave}
            disabled={saving}
            leftIcon={saving ? undefined : <Save className="w-4 h-4" />}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {saving ? 'Enabling...' : 'Enable Saving'}
          </Button>
          <button
            onClick={handleDismiss}
            className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-100 rounded"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

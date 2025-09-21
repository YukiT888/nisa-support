'use client';

import { useEffect, useState } from 'react';
import { defaultSettings, loadSettings, saveSettings } from '@/lib/storage';
import type { AppSettings } from '@/lib/types';

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadSettings().then((stored) => {
      if (stored) {
        setSettings(stored);
      }
      setReady(true);
    });
  }, []);

  const update = async (next: AppSettings) => {
    setSettings(next);
    await saveSettings(next);
  };

  return { settings, setSettings: update, ready };
}

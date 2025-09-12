'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/utils/api';

export interface Settings {
  HF_TOKEN: string;
  TRAINING_FOLDER: string;
  DATASETS_FOLDER: string;
  CAPTION_PROVIDER?: string;
  CAPTION_BASE_URL?: string;
  CAPTION_API_KEY?: string;
  CAPTION_MODEL?: string;
}

export default function useSettings() {
  const [settings, setSettings] = useState({
    HF_TOKEN: '',
    TRAINING_FOLDER: '',
    DATASETS_FOLDER: '',
    CAPTION_PROVIDER: '',
    CAPTION_BASE_URL: '',
    CAPTION_API_KEY: '',
    CAPTION_MODEL: '',
  });
  const [isSettingsLoaded, setIsLoaded] = useState(false);
  useEffect(() => {
    apiClient
      .get('/api/settings')
      .then(res => res.data)
      .then(data => {
        console.log('Settings:', data);
        setSettings({
          HF_TOKEN: data.HF_TOKEN || '',
          TRAINING_FOLDER: data.TRAINING_FOLDER || '',
          DATASETS_FOLDER: data.DATASETS_FOLDER || '',
          CAPTION_PROVIDER: data.CAPTION_PROVIDER || '',
          CAPTION_BASE_URL: data.CAPTION_BASE_URL || '',
          CAPTION_API_KEY: data.CAPTION_API_KEY || '',
          CAPTION_MODEL: data.CAPTION_MODEL || '',
        });
        setIsLoaded(true);
      })
      .catch(error => console.error('Error fetching settings:', error));
  }, []);

  return { settings, setSettings, isSettingsLoaded };
}

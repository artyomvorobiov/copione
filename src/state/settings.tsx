import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { createTranslator, I18nContext } from '@/i18n';
import { type Lang, type LangSetting, resolveLang, resolveRegion } from '@/i18n/lang';

export interface Settings {
  language: LangSetting;
  /** Hide the community average until the user has rated the title. */
  blindRatings: boolean;
  /** Hide spoiler reviews and reviews of unfinished seasons. */
  hideSpoilers: boolean;
  /** Override for the streaming/Apple Music country. */
  region: string | null;
}

const DEFAULTS: Settings = {
  language: 'auto',
  blindRatings: true,
  hideSpoilers: true,
  region: null,
};

const STORAGE_KEY = 'copione.settings.v1';

interface SettingsContextValue {
  settings: Settings;
  ready: boolean;
  lang: Lang;
  region: string;
  update: (patch: Partial<Settings>) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setSettings({ ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) });
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const lang = resolveLang(settings.language);
  const region = resolveRegion(settings.region, lang);
  const translator = useMemo(() => createTranslator(lang), [lang]);
  const value = useMemo(() => ({ settings, ready, lang, region, update }), [settings, ready, lang, region, update]);

  return (
    <SettingsContext.Provider value={value}>
      <I18nContext.Provider value={translator}>{children}</I18nContext.Provider>
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}

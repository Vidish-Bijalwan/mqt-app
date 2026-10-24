/**
 * Settings context (v1.2). Holds theme (light/dark), fontScale, language,
 * notification preferences (local alerts live since v1.3; server push
 * delivery still pending),
 * communication preferences, and the biometric gate flag, persisted via
 * src/lib/settings.ts. Provides the active colour palette and a bound
 * translator `t` for UI-chrome strings (package/blog content is never
 * translated). Safe to use outside a provider (falls back to defaults)
 * so screens render in isolation/tests.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { COLORS, DARK_COLORS } from '../theme/tokens';
import type { Palette } from '../theme/tokens';
import { translate } from '../lib/i18n';
import type { I18nKey, Language } from '../lib/i18n';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
} from '../lib/settings';
import type { Settings } from '../lib/settings';

export interface SettingsContextValue {
  settings: Settings;
  /** Merge a partial update and persist it. */
  updateSettings: (patch: Partial<Settings>) => void;
  /** Active palette: light COLORS or the dark palette. */
  colors: Palette;
  fontScale: number;
  language: Language;
  /** Translate one UI-chrome key in the current language. */
  t: (key: I18nKey) => string;
  /** Scale a base font size by the user's fontScale. */
  fs: (base: number) => number;
}

const fallback: SettingsContextValue = {
  settings: DEFAULT_SETTINGS,
  updateSettings: () => undefined,
  colors: COLORS,
  fontScale: 1,
  language: 'en',
  t: (key: I18nKey) => translate('en', key),
  fs: (base: number) => base,
};

const SettingsContext = createContext<SettingsContextValue>(fallback);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    let alive = true;
    loadSettings().then((loaded) => {
      if (alive) setSettings(loaded);
    });
    return () => {
      alive = false;
    };
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      void saveSettings(next);
      return next;
    });
  }, []);

  const value = useMemo<SettingsContextValue>(() => {
    const colors = settings.theme === 'dark' ? DARK_COLORS : COLORS;
    return {
      settings,
      updateSettings,
      colors,
      fontScale: settings.fontScale,
      language: settings.language,
      t: (key: I18nKey) => translate(settings.language, key),
      fs: (base: number) => base * settings.fontScale,
    };
  }, [settings, updateSettings]);

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  return useContext(SettingsContext);
}

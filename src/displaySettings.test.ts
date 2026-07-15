import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  applyDisplaySettings,
  getDisplaySettingsUpdateFromMessage,
  getInitialDisplaySettings,
  normalizeAccent,
  normalizeLanguage,
  normalizeTextSize,
  normalizeTheme,
  normalizeUiStyle,
  type QdnDisplaySettings,
} from './displaySettings';

const current: QdnDisplaySettings = {
  language: 'en',
  textSize: 'medium',
  theme: 'light',
  accent: 'green',
  uiStyle: 'classic',
};

describe('display settings helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('normalizes supported Core/Home display values', () => {
    expect(normalizeTheme('DARK')).toBe('dark');
    expect(normalizeLanguage('en_US')).toBe('en');
    expect(normalizeLanguage('zh-Hant')).toBe('zh-TW');
    expect(normalizeTextSize('huge')).toBe('huge');
    expect(normalizeAccent('blue')).toBe('blue');
    expect(normalizeUiStyle(' FUN ')).toBe('fun');
  });

  it('reads query settings before injected Core globals', () => {
    vi.stubGlobal('window', {
      _qdnLang: 'en',
      _qdnTextSize: 'small',
      _qdnTheme: 'light',
      _qdnAccent: 'yellow',
      _qdnUiStyle: 'modern',
      location: {
        search: '?theme=dark&textSize=huge&lang=en-US&accent=red&uiStyle=classic',
      },
    });

    expect(getInitialDisplaySettings()).toEqual({
      language: 'en',
      textSize: 'huge',
      theme: 'dark',
      accent: 'red',
      uiStyle: 'classic',
    });
  });

  it('applies individual and batched Home messages', () => {
    expect(getDisplaySettingsUpdateFromMessage({ action: 'LANGUAGE_CHANGED', language: 'ar' }, current)).toEqual({
      ...current,
      language: 'ar',
    });
    expect(getDisplaySettingsUpdateFromMessage({ action: 'UI_STYLE_CHANGED', uiStyle: 'fun' }, current)).toEqual({
      ...current,
      uiStyle: 'fun',
    });
    expect(getDisplaySettingsUpdateFromMessage({
      action: 'DISPLAY_SETTINGS_CHANGED',
      theme: 'dark',
      textSize: 'large',
      accent: 'purple',
      uiStyle: 'modern',
    }, current)).toEqual({
      ...current,
      theme: 'dark',
      textSize: 'large',
      accent: 'purple',
      uiStyle: 'modern',
    });
    expect(getDisplaySettingsUpdateFromMessage({ action: 'UI_STYLE_CHANGED', uiStyle: 'banana' }, current)).toBeNull();
    expect(getDisplaySettingsUpdateFromMessage({ action: 'THEME_CHANGED', requestedHandler: 'OTHER', theme: 'dark' }, current)).toBeNull();
  });

  it('applies display settings to the document root and RTL language', () => {
    const root = {
      dataset: {} as Record<string, string>,
      dir: '',
      lang: '',
      style: {} as Record<string, string>,
    };

    vi.stubGlobal('document', { documentElement: root });
    applyDisplaySettings({
      language: 'ar',
      textSize: 'huge',
      theme: 'dark',
      accent: 'purple',
      uiStyle: 'fun',
    });

    expect(root).toMatchObject({
      dataset: { language: 'ar', textSize: 'huge', theme: 'dark', accent: 'purple', ui: 'fun' },
      dir: 'rtl',
      lang: 'ar',
      style: { colorScheme: 'dark' },
    });
  });
});

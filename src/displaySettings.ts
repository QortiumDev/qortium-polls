import { isRtlLanguage, normalizeLanguage as normalizeSupportedLanguage, type SupportedLanguage } from './i18n';

export const TEXT_SIZE_VALUES = ['extra-small', 'small', 'medium', 'large', 'extra-large', 'huge'] as const;
export const ACCENT_OPTIONS = ['green', 'blue', 'orange', 'purple', 'red', 'teal', 'cyan', 'pink', 'yellow'] as const;
export const UI_STYLE_OPTIONS = ['classic', 'modern', 'fun'] as const;

export type QdnTheme = 'dark' | 'light';
export type QdnTextSize = (typeof TEXT_SIZE_VALUES)[number];
export type QdnAccent = (typeof ACCENT_OPTIONS)[number];
export type QdnUiStyle = (typeof UI_STYLE_OPTIONS)[number];

export type QdnDisplaySettings = {
  language: SupportedLanguage;
  textSize: QdnTextSize;
  theme: QdnTheme;
  accent: QdnAccent;
  uiStyle: QdnUiStyle;
};

type QdnHostWindow = Window & {
  _qdnAccent?: unknown;
  _qdnLang?: unknown;
  _qdnLanguage?: unknown;
  _qdnTextSize?: unknown;
  _qdnTheme?: unknown;
  _qdnUIStyle?: unknown;
  _qdnUiStyle?: unknown;
};

const defaults: QdnDisplaySettings = {
  language: 'en',
  textSize: 'medium',
  theme: 'light',
  accent: 'green',
  uiStyle: 'classic',
};

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

function normalizeChoice<T extends string>(value: unknown, choices: readonly T[]): T | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  return choices.includes(normalized as T) ? normalized as T : null;
}

export function normalizeTheme(value: unknown): QdnTheme | null {
  return normalizeChoice(value, ['light', 'dark']);
}

export function normalizeLanguage(value: unknown): SupportedLanguage | null {
  return typeof value === 'string' ? normalizeSupportedLanguage(value) : null;
}

export function normalizeTextSize(value: unknown): QdnTextSize | null {
  return normalizeChoice(value, TEXT_SIZE_VALUES);
}

export function normalizeAccent(value: unknown): QdnAccent | null {
  return normalizeChoice(value, ACCENT_OPTIONS);
}

export function normalizeUiStyle(value: unknown): QdnUiStyle | null {
  return normalizeChoice(value, UI_STYLE_OPTIONS);
}

export function getInitialDisplaySettings(): QdnDisplaySettings {
  const hostWindow = typeof window === 'undefined' ? null : window as QdnHostWindow;
  const query = typeof window === 'undefined' ? null : new URLSearchParams(window.location?.search ?? '');

  return {
    language: normalizeLanguage(query?.get('lang') ?? query?.get('language') ?? hostWindow?._qdnLang ?? hostWindow?._qdnLanguage) ?? defaults.language,
    textSize: normalizeTextSize(query?.get('textSize') ?? query?.get('text-size')) ?? normalizeTextSize(hostWindow?._qdnTextSize) ?? defaults.textSize,
    theme: normalizeTheme(query?.get('theme') ?? hostWindow?._qdnTheme) ?? defaults.theme,
    accent: normalizeAccent(query?.get('accent') ?? hostWindow?._qdnAccent) ?? defaults.accent,
    uiStyle: normalizeUiStyle(query?.get('uiStyle') ?? hostWindow?._qdnUiStyle ?? hostWindow?._qdnUIStyle) ?? defaults.uiStyle,
  };
}

export function applyDisplaySettings(settings: QdnDisplaySettings) {
  if (typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;

  root.dataset.language = settings.language;
  root.dataset.textSize = settings.textSize;
  root.dataset.theme = settings.theme;
  root.dataset.accent = settings.accent;
  root.dataset.ui = settings.uiStyle;
  root.dir = isRtlLanguage(settings.language) ? 'rtl' : 'ltr';
  root.lang = settings.language;
  root.style.colorScheme = settings.theme;
}

export function getDisplaySettingsUpdateFromMessage(
  data: unknown,
  current: QdnDisplaySettings,
): QdnDisplaySettings | null {
  if (!isObject(data) || typeof data.action !== 'string') {
    return null;
  }

  if ('requestedHandler' in data && data.requestedHandler !== 'UI') {
    return null;
  }

  switch (data.action) {
    case 'THEME_CHANGED': {
      const theme = normalizeTheme(data.theme ?? data.qdnTheme);
      return theme ? { ...current, theme } : null;
    }
    case 'LANGUAGE_CHANGED': {
      const language = normalizeLanguage(data.language ?? data.lang ?? data.qdnLang);
      return language ? { ...current, language } : null;
    }
    case 'TEXT_SIZE_CHANGED': {
      const textSize = normalizeTextSize(data.textSize ?? data.qdnTextSize);
      return textSize ? { ...current, textSize } : null;
    }
    case 'ACCENT_CHANGED': {
      const accent = normalizeAccent(data.accent ?? data.qdnAccent);
      return accent ? { ...current, accent } : null;
    }
    case 'UI_STYLE_CHANGED': {
      const uiStyle = normalizeUiStyle(data.uiStyle ?? data.ui ?? data.qdnUiStyle);
      return uiStyle ? { ...current, uiStyle } : null;
    }
    case 'DISPLAY_SETTINGS_CHANGED':
      return {
        language: normalizeLanguage(data.language ?? data.lang ?? data.qdnLang) ?? current.language,
        textSize: normalizeTextSize(data.textSize ?? data.qdnTextSize) ?? current.textSize,
        theme: normalizeTheme(data.theme ?? data.qdnTheme) ?? current.theme,
        accent: normalizeAccent(data.accent ?? data.qdnAccent) ?? current.accent,
        uiStyle: normalizeUiStyle(data.uiStyle ?? data.ui ?? data.qdnUiStyle) ?? current.uiStyle,
      };
    default:
      return null;
  }
}

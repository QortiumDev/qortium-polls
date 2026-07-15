import { EN_STRINGS } from './locales/en';

export type MessageValues = Record<string, string | number>;

export const SUPPORTED_LANGUAGES = [
  'ar',
  'de',
  'el',
  'en',
  'es',
  'et',
  'fi',
  'fr',
  'he',
  'hi',
  'hu',
  'it',
  'ja',
  'ko',
  'nb',
  'nl',
  'pl',
  'pt',
  'ro',
  'ru',
  'sv',
  'zh-CN',
  'zh-TW',
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export type MessageKey = keyof typeof EN_STRINGS;
export type TranslateFunction = ReturnType<typeof createTranslator>;

const supportedLanguageSet = new Set<string>(SUPPORTED_LANGUAGES);
const rtlLanguages = new Set<string>(['ar', 'he']);

export function normalizeLanguage(language: string | undefined): SupportedLanguage | null {
  if (!language) {
    return null;
  }

  const normalized = language.trim().replace(/_/g, '-').toLowerCase();
  const aliases: Record<string, SupportedLanguage> = {
    'en-gb': 'en',
    'en-us': 'en',
    'zh-cn': 'zh-CN',
    'zh-hans': 'zh-CN',
    'zh-hant': 'zh-TW',
    'zh-tw': 'zh-TW',
  };

  if (aliases[normalized]) {
    return aliases[normalized];
  }

  const [primary, ...rest] = normalized.split('-');

  if (primary && supportedLanguageSet.has(primary)) {
    return primary as SupportedLanguage;
  }

  if (primary === 'zh') {
    return rest.some((part) => /tw|hk|mo|hant/.test(part)) ? 'zh-TW' : 'zh-CN';
  }

  return null;
}

export function isRtlLanguage(language: SupportedLanguage) {
  return rtlLanguages.has(language);
}

export function createTranslator(_language?: string) {
  return (key: MessageKey, values?: MessageValues) => EN_STRINGS[key].replace(/\{(\w+)\}/g, (match, name) => {
    return values?.[name] === undefined ? match : String(values[name]);
  });
}

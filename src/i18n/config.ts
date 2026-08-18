export const locales = ["ru", "en", "et", "lv"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "ru";

export const LOCALE_COOKIE = "locale";

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}

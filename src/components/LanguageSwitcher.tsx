"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { localeNames, locales, LOCALE_COOKIE, type Locale } from "@/i18n/config";
import styles from "./LanguageSwitcher.module.css";

export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const router = useRouter();

  function handleChange(next: Locale) {
    document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=31536000;samesite=lax`;
    router.refresh();
  }

  return (
    <select
      className={`${styles.select} ${className ?? ""}`}
      value={locale}
      onChange={(e) => handleChange(e.target.value as Locale)}
      aria-label="Language"
    >
      {locales.map((l) => (
        <option key={l} value={l}>
          {localeNames[l]}
        </option>
      ))}
    </select>
  );
}

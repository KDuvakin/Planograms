"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { locales, LOCALE_COOKIE, type Locale } from "@/i18n/config";
import { setCookie } from "@/lib/cookies";
import styles from "./LanguageSwitcher.module.css";

const SHORT_LABEL: Record<Locale, string> = {
  ru: "RU",
  en: "EN",
  et: "ET",
  lv: "LV",
};

export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const router = useRouter();

  function handleChange(next: Locale) {
    if (next === locale) return;
    setCookie(LOCALE_COOKIE, next, 31536000);
    router.refresh();
  }

  return (
    <div className={`${styles.group} ${className ?? ""}`} role="group" aria-label="Language">
      {locales.map((l) => (
        <button
          key={l}
          type="button"
          className={l === locale ? styles.segmentActive : styles.segment}
          onClick={() => handleChange(l)}
        >
          {SHORT_LABEL[l]}
        </button>
      ))}
    </div>
  );
}

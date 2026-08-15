"use client";

import { signIn } from "next-auth/react";
import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import styles from "./login.module.css";

export default function LoginForm() {
  const t = useTranslations("login");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirect: false,
    });

    setLoading(false);

    if (!res || res.error) {
      setError(t("invalidCredentials"));
      return;
    }

    router.push(searchParams.get("callbackUrl") || "/planograms");
    router.refresh();
  }

  return (
    <form className={styles.card} onSubmit={handleSubmit}>
      <div className={styles.langRow}>
        <LanguageSwitcher />
      </div>

      <h1 className={styles.title}>{tCommon("appName")}</h1>

      <label className={styles.field}>
        <span>{t("email")}</span>
        <input name="email" type="email" required autoComplete="email" autoFocus />
      </label>

      <label className={styles.field}>
        <span>{t("password")}</span>
        <input name="password" type="password" required autoComplete="current-password" />
      </label>

      {error && <p className={styles.error}>{error}</p>}

      <button className={styles.submit} type="submit" disabled={loading}>
        {loading ? t("submitting") : t("submit")}
      </button>
    </form>
  );
}

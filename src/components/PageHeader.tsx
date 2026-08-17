"use client";

import { signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import styles from "./PageHeader.module.css";

export function PageHeader({ title }: { title: string }) {
  const tNav = useTranslations("nav");

  return (
    <header className={styles.header}>
      <h1 className={styles.title}>{title}</h1>
      <div className={styles.actions}>
        <LanguageSwitcher />
        <button className={styles.signOut} onClick={() => signOut({ redirectTo: "/login" })}>
          {tNav("signOut")}
        </button>
      </div>
    </header>
  );
}

"use client";

import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import styles from "./PageHeader.module.css";

export function PageHeader({ title }: { title: string }) {
  const tNav = useTranslations("nav");
  const router = useRouter();

  // next-auth's own redirect handling resolves the destination server-side, which in
  // dev mode has been observed to fall back to http://localhost:<port> for LAN clients
  // (a Next.js/Auth.js route-handler quirk, not something our config controls) — so we
  // skip its redirect and navigate to the relative path ourselves, which always resolves
  // against whatever origin the browser is actually on.
  async function handleSignOut() {
    await signOut({ redirect: false });
    router.push("/login");
  }

  return (
    <header className={styles.header}>
      <h1 className={styles.title}>{title}</h1>
      <div className={styles.actions}>
        <LanguageSwitcher />
        <button className={styles.signOut} onClick={handleSignOut}>
          {tNav("signOut")}
        </button>
      </div>
    </header>
  );
}

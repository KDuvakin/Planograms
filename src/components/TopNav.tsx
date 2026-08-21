"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import useSWR from "swr";
import styles from "./TopNav.module.css";
import { fetcher } from "@/lib/swrFetcher";

export function TopNav() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const tStoreFeedback = useTranslations("storeFeedback");
  const { data: session } = useSession();
  const role = session?.user?.role;
  const isAdmin = role === "ADMIN";
  const isStore = role === "STORE";
  const { data: unseen } = useSWR<{ count: number }>(
    isStore ? "/api/feedback/unseen-count" : null,
    fetcher
  );

  if (!role) return null;

  // Every role gets Планограммы + Аналитика (each sees its own slice once inside);
  // ADMIN additionally gets the admin CRUD pages, STORE additionally gets their
  // store's feedback inbox.
  const links = [
    { href: "/planograms", label: t("planograms") },
    ...(isAdmin
      ? [
          { href: "/admin/import", label: t("import") },
          { href: "/admin/users", label: t("users") },
          { href: "/admin/stores", label: t("stores") },
          { href: "/admin/printers", label: t("printers") },
        ]
      : []),
    { href: "/analytics", label: t("analytics") },
    ...(isStore ? [{ href: "/feedback", label: t("feedback") }] : []),
  ];

  return (
    <nav className={styles.nav}>
      {links.map((l) => (
        <Link key={l.href} href={l.href} className={pathname === l.href ? styles.linkActive : styles.link}>
          {l.label}
          {l.href === "/feedback" && !!unseen?.count && (
            <span className={styles.navBadge} title={tStoreFeedback("unseenBanner", { count: unseen.count })}>
              {unseen.count}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}

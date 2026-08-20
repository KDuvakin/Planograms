"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import styles from "./TopNav.module.css";

export function TopNav() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const { data: session } = useSession();
  const role = session?.user?.role;
  const isAdmin = role === "ADMIN";
  const isStore = role === "STORE";

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
        </Link>
      ))}
    </nav>
  );
}

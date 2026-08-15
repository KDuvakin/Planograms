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
  const isStaff = role === "ADMIN" || role === "MANAGER";

  if (!isStaff) return null;

  const links = [
    { href: "/planograms", label: t("planograms") },
    ...(isAdmin
      ? [
          { href: "/admin/import", label: t("import") },
          { href: "/admin/users", label: t("users") },
          { href: "/admin/stores", label: t("stores") },
        ]
      : []),
    { href: "/analytics", label: t("analytics") },
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

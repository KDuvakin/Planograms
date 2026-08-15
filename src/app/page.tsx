import Link from "next/link";
import { useTranslations } from "next-intl";
import styles from "./page.module.css";

export default function Home() {
  const t = useTranslations("home");
  const tCommon = useTranslations("common");

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.mark}>▤</div>
        <h1 className={styles.title}>{tCommon("appName")}</h1>
        <span className={styles.status}>
          <span className={styles.dot} /> {t("status")}
        </span>
        <Link href="/planograms" className={styles.link}>
          {t("link")}
        </Link>
      </div>
    </main>
  );
}

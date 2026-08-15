import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  /* Deliberately not "standalone": the production image runs `next start` with full
     node_modules so the Prisma CLI stays available in the same image for `prisma
     migrate deploy` — simpler and more robust than juggling two node_modules trees
     for a project this size. See webapp/Dockerfile. */
};

export default withNextIntl(nextConfig);

import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  /* Deliberately not "standalone": the production image runs `next start` with full
     node_modules so the Prisma CLI stays available in the same image for `prisma
     migrate deploy` — simpler and more robust than juggling two node_modules trees
     for a project this size. See webapp/Dockerfile. */

  /* Dev server LAN access (testing from a phone/tablet on the store Wi-Fi): Next.js
     blocks cross-origin dev asset requests by default, which silently breaks client
     JS (and with it next-auth's signIn()) for anyone but localhost. Only matters for
     `next dev` — add this machine's current LAN IP whenever it changes. */
  allowedDevOrigins: ["192.168.8.254", "192.168.1.38", "192.168.9.4"],
};

export default withNextIntl(nextConfig);

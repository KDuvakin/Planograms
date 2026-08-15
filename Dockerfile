# ---- deps: full dependency tree (incl. devDependencies, needed to build) ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder: compile Next.js + generate the Prisma client ----
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# `prisma generate` only reads schema.prisma (no live DB needed) but prisma.config.ts
# still resolves DATABASE_URL — a placeholder is enough to satisfy it at build time.
ENV DATABASE_URL="sqlserver://build:1433;database=build;user=build;password=build"
RUN npx prisma generate
RUN npm run build

# ---- runner: production image ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Full node_modules (prod deps only) — keeps the Prisma CLI available in this same
# image for `npx prisma migrate deploy` at release time, see DEPLOY.md.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/src/generated ./src/generated

RUN mkdir -p public/uploads/feedback && chown -R nextjs:nodejs public/uploads .next

USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["npx", "next", "start"]

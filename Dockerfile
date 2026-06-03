FROM node:22-alpine AS base

# Install deps
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
ENV NODE_ENV=development
COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm install

# Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
# NextAuth checks AUTH_SECRET at module init during static build; placeholder overridden at runtime
ENV AUTH_SECRET=next-build-placeholder
ENV NEXTAUTH_SECRET=next-build-placeholder
ENV NEXTAUTH_URL=http://localhost:3000
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV TZ=Asia/Kuala_Lumpur

RUN apk add --no-cache curl su-exec && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma


COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "server.js"]

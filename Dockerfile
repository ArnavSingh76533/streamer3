# Install dependencies only when needed
FROM node:21.0-alpine AS deps
WORKDIR /app

# libc6-compat helps some native deps
RUN apk add --no-cache libc6-compat

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# Rebuild the source code only when needed
FROM node:21.0-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN yarn build

# Production image, copy all the files and run Next.js
FROM node:21.0-alpine AS runner
WORKDIR /app

# Default envs (override in Space settings)
ENV SITE_NAME="Web-SyncPlay"
# Set this in Space settings to your Space URL, e.g. https://your-username-web-syncplay.hf.space
ENV PUBLIC_DOMAIN="shivam413-Streamer.hf.space"
# Use a managed Redis URL (e.g. Upstash) set in Space settings
ENV REDIS_URL="redis://default:S5BoZJYMmACrcbLH7HpPZC4fpV0mNWHR@redis-18916.c309.us-east-2-1.ec2.redns.redis-cloud.com:18916"

# Hugging Face Spaces expects your app to listen on $PORT (default 7860)
ENV PORT=7860
EXPOSE 7860

LABEL org.opencontainers.image.url="https://web-syncplay.de" \
      org.opencontainers.image.description="Watch videos or play music in sync with your friends" \
      org.opencontainers.image.title="Web-SyncPlay" \
      maintainer="Yasamato <https://github.com/Yasamato>"

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 && \
    apk add --no-cache curl python3 py3-pip &&  \
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp

# Static assets and standalone output
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

# Next.js will pick up PORT env var
CMD ["sh", "-c", "node server.js"]
# Dockerfile: satu proses Node 24 menyajikan API, PWA hasil build, dan basis data SQLite di /data.
# Jalankan: docker build -t ihsan-finance . && docker run -p 8787:8787 -v ihsan-data:/data ihsan-finance
# Catatan: berkas ini belum pernah dibangun di mesin pengembangan (Docker tidak terpasang di sana);
# pembuktian pertama ada di deploy pertama, dan perintah yang sama dijalankan tanpa wadah lebih dulu.

FROM node:24-slim AS build
ENV PNPM_HOME=/pnpm
ENV PATH=/pnpm:$PATH
RUN npm install --global pnpm@10
WORKDIR /app
COPY app/package.json app/pnpm-lock.yaml app/pnpm-workspace.yaml ./
COPY app/server/package.json server/
COPY app/web/package.json web/
RUN pnpm install --frozen-lockfile
COPY app/ ./
RUN pnpm --dir web build

FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8787 \
    IHSAN_DATA_DIR=/data
COPY --from=build /app /app
RUN mkdir -p /data && chown -R node:node /data
USER node
VOLUME ["/data"]
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT ?? 8787}/api/v1/health`).then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"]
CMD ["node", "server/src/main.ts"]

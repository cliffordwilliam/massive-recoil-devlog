FROM oven/bun:1.3.11-alpine
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --ignore-scripts
COPY . .
USER bun
EXPOSE 3000
CMD ["bun", "run", "index.ts"]

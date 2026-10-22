# Test stage — devDependencies for jest in docker-compose.test.yml
FROM node:22-alpine AS test

RUN addgroup -S greenpay && adduser -S greenpay -G greenpay

WORKDIR /app

COPY --chown=greenpay:greenpay package*.json ./
RUN npm ci && chown -R greenpay:greenpay /app/node_modules

COPY --chown=greenpay:greenpay . .

USER greenpay

CMD ["npm", "test"]

# Development stage — installs the full dependency tree (including
# devDependencies such as nodemon) for `npm run dev:docker`. docker-compose
# bind-mounts ./src here so file edits restart the server. Kept before the
# builder so the default build target stays the production `runner`.
# Dev stage — `npm run dev:docker` uses nodemon, which is a devDependency.
# Used as the build target by docker-compose.yml and docker-compose.dev.yml;
# the runner (production) and test stages are unaffected.
FROM node:22-alpine AS dev

RUN addgroup -S greenpay && adduser -S greenpay -G greenpay

WORKDIR /app

ENV NODE_ENV development

COPY --chown=greenpay:greenpay package*.json ./
# --legacy-peer-deps: the lockfile pins ioredis@6 while ioredis-mock@8
# declares a peer of ioredis@5, so a plain `npm ci` aborts with ERESOLVE.
# Only this stage relaxes peers; the deploy stages are untouched.
RUN npm ci --legacy-peer-deps && chown -R greenpay:greenpay /app/node_modules
# Copy package files and install ALL dependencies (incl. nodemon)
COPY --chown=greenpay:greenpay package*.json ./
RUN npm ci && chown -R greenpay:greenpay /app/node_modules

COPY --chown=greenpay:greenpay . .

EXPOSE 4000

USER greenpay

CMD ["npm", "run", "dev:docker"]

# 1. Builder Stage
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

# 2. Production Runner Stage
FROM node:22-alpine AS runner

RUN addgroup -S greenpay && adduser -S greenpay -G greenpay

WORKDIR /app

ENV NODE_ENV production

# Copy package files and production dependencies
COPY --chown=greenpay:greenpay package*.json ./
COPY --from=builder --chown=greenpay:greenpay /app/node_modules ./node_modules

# Copy source code
COPY --chown=greenpay:greenpay . .

EXPOSE 4000

USER greenpay

# Run Node.js directly as PID 1 (best practice)
CMD ["node", "src/server.js"]

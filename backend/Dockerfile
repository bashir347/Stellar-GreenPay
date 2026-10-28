# Test stage — devDependencies for jest in docker-compose.test.yml
FROM node:22-alpine AS test

RUN addgroup -S greenpay && adduser -S greenpay -G greenpay

WORKDIR /app

COPY --chown=greenpay:greenpay package*.json ./
RUN npm ci && chown -R greenpay:greenpay /app/node_modules

COPY --chown=greenpay:greenpay . .

USER greenpay

CMD ["npm", "test"]

# Dev stage — full deps (incl. nodemon) for docker-compose dev hot reload.
# Not the default target: deploys still build the final "runner" stage.
FROM node:22-alpine AS dev

RUN addgroup -S greenpay && adduser -S greenpay -G greenpay

WORKDIR /app

ENV NODE_ENV development

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

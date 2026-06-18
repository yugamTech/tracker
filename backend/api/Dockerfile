# Yaanam API container.
#
# IMPORTANT: build with the repo ROOT as context so npm workspaces resolve:
#   docker build -f backend/api/Dockerfile -t yaanam-api .
#
# Railway/Render: set the Dockerfile path to backend/api/Dockerfile and the
# build context / root directory to the repository root.

# ---- build stage -----------------------------------------------------------
FROM node:20-alpine AS build
# Prisma's engines need OpenSSL present at generate/build time.
RUN apk add --no-cache openssl
WORKDIR /app

# Install the full workspace (dev deps included — nest build needs them).
COPY package.json package-lock.json ./
COPY backend/api/package.json backend/api/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/api-client/package.json packages/api-client/package.json
RUN npm ci

# Build the shared types package, then the API (prisma generate + nest build).
COPY . .
RUN npm run build --workspace=packages/types \
 && npm run build --workspace=backend/api

# ---- runtime stage ---------------------------------------------------------
FROM node:20-alpine AS runtime
RUN apk add --no-cache openssl
ENV NODE_ENV=production
WORKDIR /app

# Carry over installed deps (incl. the generated Prisma client) and build output.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/packages ./packages
COPY --from=build /app/backend/api/dist ./backend/api/dist
COPY --from=build /app/backend/api/package.json ./backend/api/package.json
COPY --from=build /app/backend/api/prisma ./backend/api/prisma

WORKDIR /app/backend/api
EXPOSE 3000

# Apply any pending migrations, then boot. `migrate deploy` is idempotent and
# safe to run on every container start.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]

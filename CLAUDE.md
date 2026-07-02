# Yaanam — session bootstrap

Multi-tenant school-bus tracking monorepo (npm workspaces): `backend/api` (NestJS +
Prisma + Postgres + Redis + Socket.IO), Expo/RN apps `apps/{admin,parent,driver}-app`,
shared `packages/{types,api-client,ui,config}`.

**Read first, every session:** `docs/HANDOFF.md` (state + conventions + backlog) and
`docs/AUDIT.md` (verified findings; §9 = prioritized order of work). Those two files
are the source of truth — this file is just the pointer + the hard rules.

## Non-negotiable conventions

1. **Tenant isolation is sacred.** One branch = one tenant = one school (no `Branch`
   model). Every query: `findFirst({ where: { id, tenantId } })` + `@TenantId()` +
   `RolesGuard`/`@Roles`. NEVER `findFirstOrThrow`/`findUniqueOrThrow` on
   user-supplied ids (500s) — use `findFirst` + `NotFoundException`/
   `BadRequestException`/`ConflictException`. DTOs use class-validator (global pipe:
   whitelist + forbidNonWhitelisted + transform).
2. **Verify, don't trust.** A "done / N tests passed" report is not proof. Run
   `npm run typecheck` + `npm run lint` (exit 0) and the REAL e2e suite; paste actual
   output. Re-read correctness-critical code before merging.
3. **e2e runs on the Docker test DB:**
   `docker compose -f docker/docker-compose.test.yml up -d` (Postgres :5433, Redis :6380), then
   `DATABASE_URL=postgresql://saarthi:saarthi_secret@localhost:5433/saarthi_test?schema=public npm run db:migrate:prod --workspace=backend/api`, then same DATABASE_URL +
   `REDIS_PORT=6380 OTP_BYPASS_MODE=true OTP_BYPASS_CODE=123456 NODE_ENV=test npm run test:e2e --workspace=backend/api`.
4. **Workflow:** build on a branch → verify → merge `--no-ff` to main → push → CI
   green. One commit per logical item. Update `docs/HANDOFF.md`/`docs/AUDIT.md` as
   work lands.
5. **Gotchas:** `@yaanam/types` resolves to `dist` — rebuild after editing types;
   `@yaanam/api-client` resolves to `src` (no build). MapLibre (live map) needs a
   real/dev build — Expo Go shows a fallback tile. Stale Metro cache after adding
   workspace files: `npx expo start -c`. Stored photos must go through
   `resolvePhotoUrl()`. PRDs live in `PRDS/` (gitignored).

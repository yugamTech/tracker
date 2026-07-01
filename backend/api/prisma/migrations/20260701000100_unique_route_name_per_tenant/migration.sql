-- Enforce a unique route name within each tenant.
--
-- Dropping Route.direction (previous migration) can collapse two same-named
-- routes (one PICKUP, one DROP) into a name clash, so dedupe BEFORE adding the
-- unique index or it would fail. For each (tenantId, name) group keep the oldest
-- row (lowest id) untouched and suffix the rest with " (2)", " (3)", … so the
-- index can be created without data loss. Idempotent enough for a one-shot deploy.
WITH ranked AS (
  SELECT "id",
         row_number() OVER (PARTITION BY "tenantId", "name" ORDER BY "id") AS rn
  FROM "Route"
)
UPDATE "Route" r
SET "name" = r."name" || ' (' || ranked.rn || ')'
FROM ranked
WHERE r."id" = ranked."id" AND ranked.rn > 1;

-- CreateIndex
CREATE UNIQUE INDEX "Route_tenantId_name_key" ON "Route"("tenantId", "name");

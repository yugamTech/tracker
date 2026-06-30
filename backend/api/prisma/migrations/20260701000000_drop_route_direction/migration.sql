-- A route is now direction-agnostic (it serves both PICKUP and DROP trips); the
-- direction lives on each Trip. Drop the required Route.direction column. The
-- Direction enum stays — Trip.direction still uses it.
ALTER TABLE "Route" DROP COLUMN "direction";

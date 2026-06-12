-- Dedup guarantee for batch location-ping ingest: one row per (trip, sequence)
CREATE UNIQUE INDEX "LocationPing_tripId_sequence_key" ON "LocationPing"("tripId", "sequence");

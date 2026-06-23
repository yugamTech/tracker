import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { TripsService } from './trips.service';

// Started-not-completed trips escalate on an hours scale (PRD-02a §3.2), so this
// sweeps far less often than the signal-loss sweep. The thresholds themselves live
// in TripsService as named config constants.
const SWEEP_INTERVAL_MS = 5 * 60_000;

/**
 * Periodic trigger for the started-not-completed mechanism (PRD-02a), mirroring
 * {@link SignalLossService}'s @Interval sweep. The actual threshold logic, auto-abort
 * and notification live in TripsService.runLifecycleSweep() so all trip rules stay in
 * one place; this service is just the scheduled wrapper.
 */
@Injectable()
export class TripOverdueSweepService {
  private readonly logger = new Logger(TripOverdueSweepService.name);

  constructor(private readonly trips: TripsService) {}

  @Interval('trip-overdue-sweep', SWEEP_INTERVAL_MS)
  async sweep(): Promise<void> {
    try {
      await this.trips.runLifecycleSweep();
    } catch (err) {
      this.logger.error(`Trip overdue sweep failed: ${(err as Error).message}`);
    }
  }
}

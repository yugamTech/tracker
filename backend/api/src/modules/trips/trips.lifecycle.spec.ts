/**
 * Unit tests for the TripsService lifecycle state machine.
 *
 * Covers:
 *  - TRANSITIONS map: which status changes are allowed / illegal.
 *  - PARENT role pre-check: start() and complete() reject PARENT actors before
 *    any DB call (security fix 6f4454b).
 *
 * All Prisma + gateway + notification dependencies are mocked; no DB or network
 * required.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TripsService } from './trips.service';
import { PrismaService } from '../../infra/database/prisma.service';
import { TrackingGateway } from '../tracking/tracking.gateway';
import { LocationService } from '../tracking/location.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Role } from '@yaanam/types';

const TRIP_ID = 'trip-unit-1';
const TENANT_ID = 'tenant-unit-a';

/** Minimal trip-shaped object for mocking Prisma responses. */
function makeTrip(status: string) {
  return {
    id: TRIP_ID,
    tenantId: TENANT_ID,
    status,
    vehicleId: null,
    driverId: null,
    conductorId: null,
    direction: 'PICKUP',
    date: new Date(),
    scheduledStart: null,
    startedAt: null,
    completedAt: null,
    route: null,
  };
}

describe('TripsService — lifecycle state machine', () => {
  let service: TripsService;
  let tripFindFirst: jest.Mock;
  let tripFindUnique: jest.Mock;
  let tripUpdate: jest.Mock;
  let emitTripStatus: jest.Mock;

  beforeEach(async () => {
    tripFindFirst = jest.fn();
    tripFindUnique = jest.fn();
    tripUpdate = jest.fn().mockResolvedValue({ id: TRIP_ID, status: 'CANCELLED', tenantId: TENANT_ID });
    emitTripStatus = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TripsService,
        {
          provide: PrismaService,
          useValue: {
            trip: { findFirst: tripFindFirst, findUnique: tripFindUnique, update: tripUpdate, findMany: jest.fn().mockResolvedValue([]) },
            tripRider: { findMany: jest.fn().mockResolvedValue([]), updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
            vehicleAssignment: { findMany: jest.fn().mockResolvedValue([]) },
            membership: { findMany: jest.fn().mockResolvedValue([]) },
            guardianship: { findMany: jest.fn().mockResolvedValue([]) },
            dailyCheck: { count: jest.fn().mockResolvedValue(0) },
            tripStartException: { create: jest.fn() },
            tripLifecycleEvent: { count: jest.fn().mockResolvedValue(0), create: jest.fn() },
            ageGroup: { findMany: jest.fn().mockResolvedValue([]) },
            route: { findFirst: jest.fn(), findUnique: jest.fn() },
            student: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
          },
        },
        { provide: TrackingGateway, useValue: { emitTripStatus } },
        { provide: LocationService, useValue: { clearTripCache: jest.fn() } },
        { provide: NotificationsService, useValue: { dispatch: jest.fn().mockResolvedValue(undefined) } },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    service = module.get(TripsService);
  });

  // ── cancel() exercises the SCHEDULED → CANCELLED edge ────────────────────

  describe('cancel()', () => {
    it('SCHEDULED → CANCELLED succeeds', async () => {
      tripFindFirst.mockResolvedValue(makeTrip('SCHEDULED'));
      tripFindUnique.mockResolvedValue(makeTrip('SCHEDULED'));

      await expect(service.cancel(TRIP_ID, TENANT_ID)).resolves.toBeDefined();
      expect(tripUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'CANCELLED' }) }),
      );
    });

    // Every status other than SCHEDULED has no path to CANCELLED in the TRANSITIONS map.
    it.each([
      ['STARTED'],
      ['IN_PROGRESS'],
      ['COMPLETED'],
      ['CANCELLED'],
      ['ABORTED'],
    ])('%s → CANCELLED throws BadRequestException (illegal transition)', async (fromStatus) => {
      tripFindFirst.mockResolvedValue(makeTrip(fromStatus));
      tripFindUnique.mockResolvedValue(makeTrip(fromStatus));

      await expect(service.cancel(TRIP_ID, TENANT_ID)).rejects.toThrow(BadRequestException);
      expect(tripUpdate).not.toHaveBeenCalled();
    });
  });

  // ── start() / complete() PARENT role pre-check (security fix 6f4454b) ────

  describe('start() — PARENT role pre-check', () => {
    it('throws ForbiddenException immediately without touching the DB', async () => {
      const actor = { personId: 'p1', membershipId: 'm1', tenantId: TENANT_ID, role: Role.PARENT };

      await expect(service.start(TRIP_ID, { actor })).rejects.toThrow(ForbiddenException);

      // No DB call should have been made: the check fires before any Prisma query.
      expect(tripFindFirst).not.toHaveBeenCalled();
      expect(tripFindUnique).not.toHaveBeenCalled();
    });
  });

  describe('complete() — PARENT role pre-check', () => {
    it('throws ForbiddenException immediately without touching the DB', async () => {
      const actor = { personId: 'p1', membershipId: 'm1', tenantId: TENANT_ID, role: Role.PARENT };

      await expect(service.complete(TRIP_ID, { actor })).rejects.toThrow(ForbiddenException);

      expect(tripFindFirst).not.toHaveBeenCalled();
      expect(tripFindUnique).not.toHaveBeenCalled();
    });
  });

  // ── Transition map completeness: terminal states have no outgoing edges ───

  describe('terminal states — no valid outgoing transitions via cancel()', () => {
    it.each([['COMPLETED'], ['CANCELLED'], ['ABORTED']])(
      '%s is terminal (no cancel edge)',
      async (status) => {
        tripFindFirst.mockResolvedValue(makeTrip(status));
        tripFindUnique.mockResolvedValue(makeTrip(status));

        await expect(service.cancel(TRIP_ID, TENANT_ID)).rejects.toThrow(BadRequestException);
      },
    );
  });
});

import { Prisma, PrismaClient } from '@prisma/client';
import { normalizeIndianPhone } from '../identity/phone.util';
import { STAFF_ROLES } from '../identity/members.service';
import type { Role } from '@yaanam/types';
import type { ImportEntityType, ParsedRow } from './onboarding.templates';

/**
 * Per-entity import logic for the bulk Excel pipeline (PRD-01 FR-16–21).
 *
 * Each importer produces an {@link ImportPlan}: the validation errors, the
 * create/update counts for the dry-run preview, and an `apply(tx)` closure that
 * performs the writes. The SAME plan drives both endpoints — `validate` returns
 * everything but `apply`, and `commit` runs `apply` inside one transaction — so
 * the preview can never disagree with what a commit actually does.
 *
 * Idempotency (FR-19): people by E.164 phone, students/vehicles by registration
 * id/number, and the name-keyed entities (routes, stops, age groups) by name
 * within the tenant. Re-uploading a corrected file UPDATES, never duplicates.
 */

export interface RowError {
  row: number;
  field: string;
  message: string;
}

export interface ImportPlan {
  errors: RowError[];
  willCreate: number;
  willUpdate: number;
  apply: (tx: Prisma.TransactionClient) => Promise<{ created: number; updated: number }>;
}

export interface ImportContext {
  tenantId: string;
  createdById: string;
}

export type Importer = (
  prisma: PrismaClient,
  ctx: ImportContext,
  rows: ParsedRow[],
) => Promise<ImportPlan>;

// ─── shared helpers ─────────────────────────────────────────────────────────

const TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;

function req(row: ParsedRow, field: string, errors: RowError[]): string | null {
  const v = row.values[field]?.trim();
  if (!v) {
    errors.push({ row: row.rowNumber, field, message: `${field} is required` });
    return null;
  }
  return v;
}

/** Returns the normalized +91 phone, or null (pushing an error) if malformed. */
function phone(row: ParsedRow, field: string, errors: RowError[]): string | null {
  const raw = row.values[field]?.trim();
  if (!raw) {
    errors.push({ row: row.rowNumber, field, message: `${field} is required` });
    return null;
  }
  const digits = raw.replace(/\D/g, '');
  const ok = digits.length === 10 || (digits.length === 12 && digits.startsWith('91'));
  if (!ok) {
    errors.push({ row: row.rowNumber, field, message: `${field} must be a 10-digit mobile number` });
    return null;
  }
  return normalizeIndianPhone(raw);
}

function intField(row: ParsedRow, field: string, errors: RowError[], opts: { min?: number } = {}): number | null {
  const v = row.values[field]?.trim();
  if (!v) {
    errors.push({ row: row.rowNumber, field, message: `${field} is required` });
    return null;
  }
  const n = Number(v);
  if (!Number.isInteger(n) || (opts.min !== undefined && n < opts.min)) {
    errors.push({ row: row.rowNumber, field, message: `${field} must be a whole number${opts.min !== undefined ? ` ≥ ${opts.min}` : ''}` });
    return null;
  }
  return n;
}

function floatField(
  row: ParsedRow,
  field: string,
  errors: RowError[],
  opts: { min?: number; max?: number } = {},
): number | null {
  const v = row.values[field]?.trim();
  if (!v) {
    errors.push({ row: row.rowNumber, field, message: `${field} is required` });
    return null;
  }
  const n = Number(v);
  if (Number.isNaN(n)) {
    errors.push({ row: row.rowNumber, field, message: `${field} must be a number` });
    return null;
  }
  if ((opts.min !== undefined && n < opts.min) || (opts.max !== undefined && n > opts.max)) {
    const range =
      opts.min !== undefined && opts.max !== undefined ? ` between ${opts.min} and ${opts.max}` : '';
    errors.push({ row: row.rowNumber, field, message: `${field} must be a number${range}` });
    return null;
  }
  return n;
}

const norm = (s: string) => s.trim().toLowerCase();

// ─── routes_stops ───────────────────────────────────────────────────────────

const routesStopsImporter: Importer = async (prisma, ctx, rows) => {
  const errors: RowError[] = [];

  const existingRoutes = await prisma.route.findMany({
    where: { tenantId: ctx.tenantId },
    select: { id: true, name: true, direction: true },
  });
  const routeKey = (name: string, dir: string) => `${norm(name)}|${dir}`;
  const existingRouteByKey = new Map(existingRoutes.map((r) => [routeKey(r.name, r.direction), r.id]));

  const existingStops = await prisma.stop.findMany({
    where: { tenantId: ctx.tenantId },
    select: { id: true, name: true },
  });
  const existingStopByName = new Map(existingStops.map((s) => [norm(s.name), s.id]));

  const existingRouteStops = await prisma.routeStop.findMany({
    where: { route: { tenantId: ctx.tenantId } },
    select: { routeId: true, sequence: true },
  });
  const existingLink = new Set(existingRouteStops.map((rs) => `${rs.routeId}|${rs.sequence}`));

  // Validate each row + detect in-file conflicts.
  const seenSeq = new Set<string>();
  const routeDir = new Map<string, string>(); // routeName(norm) → direction (consistency check)
  let willCreate = 0;
  let willUpdate = 0;

  interface PlanRow {
    routeName: string; direction: 'PICKUP' | 'DROP'; stopName: string;
    sequence: number; lat: number; lng: number; geofence?: number;
  }
  const planRows: PlanRow[] = [];

  for (const row of rows) {
    const before = errors.length;
    const routeName = req(row, 'routeName', errors);
    const dirRaw = req(row, 'direction', errors);
    const stopName = req(row, 'stopName', errors);
    const sequence = intField(row, 'sequence', errors, { min: 1 });
    const lat = floatField(row, 'lat', errors, { min: -90, max: 90 });
    const lng = floatField(row, 'lng', errors, { min: -180, max: 180 });
    let geofence: number | undefined;
    if (row.values.geofenceRadius?.trim()) {
      const g = intField(row, 'geofenceRadius', errors, { min: 0 });
      if (g !== null) geofence = g;
    }

    let direction: 'PICKUP' | 'DROP' | null = null;
    if (dirRaw) {
      const d = dirRaw.toUpperCase();
      if (d !== 'PICKUP' && d !== 'DROP') {
        errors.push({ row: row.rowNumber, field: 'direction', message: 'direction must be PICKUP or DROP' });
      } else direction = d;
    }

    if (errors.length > before || !routeName || !stopName || sequence === null || lat === null || lng === null || !direction) continue;

    // A route name must keep one direction across the file.
    const rk = norm(routeName);
    const priorDir = routeDir.get(rk);
    if (priorDir && priorDir !== direction) {
      errors.push({ row: row.rowNumber, field: 'direction', message: `route "${routeName}" has conflicting directions in the file` });
      continue;
    }
    routeDir.set(rk, direction);

    // (route, sequence) must be unique within the file.
    const seqKey = `${rk}|${sequence}`;
    if (seenSeq.has(seqKey)) {
      errors.push({ row: row.rowNumber, field: 'sequence', message: `duplicate sequence ${sequence} for route "${routeName}" in the file` });
      continue;
    }
    seenSeq.add(seqKey);

    planRows.push({ routeName, direction, stopName, sequence, lat, lng, geofence });

    // Count create vs update by whether this route already has this sequence.
    const existingRouteId = existingRouteByKey.get(routeKey(routeName, direction));
    if (existingRouteId && existingLink.has(`${existingRouteId}|${sequence}`)) willUpdate++;
    else willCreate++;
  }

  const apply = async (tx: Prisma.TransactionClient) => {
    let created = 0;
    let updated = 0;
    const routeIdCache = new Map<string, string>();
    const stopIdCache = new Map<string, string>();

    for (const r of planRows) {
      // find-or-create route (name + direction), tenant-scoped.
      const rk = routeKey(r.routeName, r.direction);
      let routeId = routeIdCache.get(rk) ?? existingRouteByKey.get(rk);
      if (!routeId) {
        const route = await tx.route.create({
          data: { tenantId: ctx.tenantId, name: r.routeName, direction: r.direction },
        });
        routeId = route.id;
        existingRouteByKey.set(rk, routeId);
      }
      routeIdCache.set(rk, routeId);

      // find-or-create stop (by name), updating coordinates.
      const sk = norm(r.stopName);
      let stopId = stopIdCache.get(sk) ?? existingStopByName.get(sk);
      if (stopId) {
        await tx.stop.update({
          where: { id: stopId },
          data: { lat: r.lat, lng: r.lng, ...(r.geofence !== undefined ? { geofenceRadius: r.geofence } : {}) },
        });
      } else {
        const stop = await tx.stop.create({
          data: {
            tenantId: ctx.tenantId, name: r.stopName, lat: r.lat, lng: r.lng,
            ...(r.geofence !== undefined ? { geofenceRadius: r.geofence } : {}),
          },
        });
        stopId = stop.id;
        existingStopByName.set(sk, stopId);
      }
      stopIdCache.set(sk, stopId);

      // upsert the ordered link (route, sequence) → stop.
      const existing = await tx.routeStop.findUnique({
        where: { routeId_sequence: { routeId, sequence: r.sequence } },
        select: { id: true },
      });
      if (existing) {
        await tx.routeStop.update({ where: { id: existing.id }, data: { stopId } });
        updated++;
      } else {
        await tx.routeStop.create({ data: { routeId, stopId, sequence: r.sequence } });
        created++;
      }
    }
    return { created, updated };
  };

  return { errors, willCreate, willUpdate, apply };
};

// ─── age_groups ─────────────────────────────────────────────────────────────

const ageGroupsImporter: Importer = async (prisma, ctx, rows) => {
  const errors: RowError[] = [];

  const existing = await prisma.ageGroup.findMany({
    where: { tenantId: ctx.tenantId },
    select: { id: true, name: true },
  });
  const existingByName = new Map(existing.map((a) => [norm(a.name), a.id]));

  const routes = await prisma.route.findMany({
    where: { tenantId: ctx.tenantId },
    select: { id: true, name: true },
  });
  const routeByName = new Map(routes.map((r) => [norm(r.name), r.id]));

  const seen = new Set<string>();
  let willCreate = 0;
  let willUpdate = 0;
  interface PlanRow { name: string; pickupTime: string; dropTime: string; routeId?: string }
  const planRows: PlanRow[] = [];

  for (const row of rows) {
    const before = errors.length;
    const name = req(row, 'name', errors);
    const pickupTime = req(row, 'pickupTime', errors);
    const dropTime = req(row, 'dropTime', errors);
    if (pickupTime && !TIME_RE.test(pickupTime)) errors.push({ row: row.rowNumber, field: 'pickupTime', message: 'pickupTime must be HH:MM (24h)' });
    if (dropTime && !TIME_RE.test(dropTime)) errors.push({ row: row.rowNumber, field: 'dropTime', message: 'dropTime must be HH:MM (24h)' });

    let routeId: string | undefined;
    const routeName = row.values.routeName?.trim();
    if (routeName) {
      routeId = routeByName.get(norm(routeName));
      if (!routeId) errors.push({ row: row.rowNumber, field: 'routeName', message: `route "${routeName}" does not exist — import routes first` });
    }

    if (errors.length > before || !name || !pickupTime || !dropTime) continue;

    const key = norm(name);
    if (seen.has(key)) {
      errors.push({ row: row.rowNumber, field: 'name', message: `duplicate age group "${name}" in the file` });
      continue;
    }
    seen.add(key);

    planRows.push({ name, pickupTime, dropTime, routeId });
    if (existingByName.has(key)) willUpdate++;
    else willCreate++;
  }

  const apply = async (tx: Prisma.TransactionClient) => {
    let created = 0;
    let updated = 0;
    for (const r of planRows) {
      const id = existingByName.get(norm(r.name));
      if (id) {
        await tx.ageGroup.update({ where: { id }, data: { pickupTime: r.pickupTime, dropTime: r.dropTime, routeId: r.routeId ?? null } });
        updated++;
      } else {
        await tx.ageGroup.create({ data: { tenantId: ctx.tenantId, name: r.name, pickupTime: r.pickupTime, dropTime: r.dropTime, routeId: r.routeId } });
        created++;
      }
    }
    return { created, updated };
  };

  return { errors, willCreate, willUpdate, apply };
};

// ─── vehicles ───────────────────────────────────────────────────────────────

const VEHICLE_STATUS = ['ACTIVE', 'INACTIVE', 'MAINTENANCE'];

const vehiclesImporter: Importer = async (prisma, ctx, rows) => {
  const errors: RowError[] = [];

  const existing = await prisma.vehicle.findMany({
    where: { tenantId: ctx.tenantId },
    select: { regNumber: true },
  });
  const existingRegs = new Set(existing.map((v) => norm(v.regNumber)));

  const seen = new Set<string>();
  let willCreate = 0;
  let willUpdate = 0;
  interface PlanRow { regNumber: string; capacity: number; type?: string; status?: string }
  const planRows: PlanRow[] = [];

  for (const row of rows) {
    const before = errors.length;
    const regNumber = req(row, 'regNumber', errors);
    const capacity = intField(row, 'capacity', errors, { min: 1 });
    const type = row.values.type?.trim() || undefined;
    const status = row.values.status?.trim()?.toUpperCase() || undefined;
    if (status && !VEHICLE_STATUS.includes(status)) errors.push({ row: row.rowNumber, field: 'status', message: `status must be one of ${VEHICLE_STATUS.join(', ')}` });

    if (errors.length > before || !regNumber || capacity === null) continue;

    const key = norm(regNumber);
    if (seen.has(key)) {
      errors.push({ row: row.rowNumber, field: 'regNumber', message: `duplicate registration "${regNumber}" in the file` });
      continue;
    }
    seen.add(key);

    planRows.push({ regNumber, capacity, type, status });
    if (existingRegs.has(key)) willUpdate++;
    else willCreate++;
  }

  const apply = async (tx: Prisma.TransactionClient) => {
    let created = 0;
    let updated = 0;
    for (const r of planRows) {
      const isUpdate = existingRegs.has(norm(r.regNumber));
      await tx.vehicle.upsert({
        where: { tenantId_regNumber: { tenantId: ctx.tenantId, regNumber: r.regNumber } },
        update: { capacity: r.capacity, ...(r.type ? { type: r.type } : {}), ...(r.status ? { status: r.status as never } : {}) },
        create: {
          tenantId: ctx.tenantId, regNumber: r.regNumber, capacity: r.capacity,
          ...(r.type ? { type: r.type } : {}), ...(r.status ? { status: r.status as never } : {}),
        },
      });
      if (isUpdate) updated++; else created++;
    }
    return { created, updated };
  };

  return { errors, willCreate, willUpdate, apply };
};

// ─── staff ──────────────────────────────────────────────────────────────────

const staffImporter: Importer = async (prisma, ctx, rows) => {
  const errors: RowError[] = [];
  const validRoles = STAFF_ROLES.map((r) => String(r));

  const seen = new Set<string>(); // phone|role within file
  interface PlanRow { phone: string; name: string; role: string; email?: string }
  const planRows: PlanRow[] = [];

  for (const row of rows) {
    const before = errors.length;
    const name = req(row, 'name', errors);
    const phoneVal = phone(row, 'phone', errors);
    const roleRaw = req(row, 'role', errors);
    const email = row.values.email?.trim() || undefined;

    let role: string | null = null;
    if (roleRaw) {
      const r = roleRaw.toUpperCase();
      if (!validRoles.includes(r)) errors.push({ row: row.rowNumber, field: 'role', message: `role must be one of ${validRoles.join(', ')}` });
      else role = r;
    }

    if (errors.length > before || !name || !phoneVal || !role) continue;

    const key = `${phoneVal}|${role}`;
    if (seen.has(key)) {
      errors.push({ row: row.rowNumber, field: 'phone', message: `duplicate ${role} for ${phoneVal} in the file` });
      continue;
    }
    seen.add(key);
    planRows.push({ phone: phoneVal, name, role, email });
  }

  // Count create vs update against existing memberships for these phones.
  const phones = [...new Set(planRows.map((r) => r.phone))];
  const persons = await prisma.person.findMany({ where: { phone: { in: phones } }, select: { id: true, phone: true } });
  const personIdByPhone = new Map(persons.map((p) => [p.phone, p.id]));
  const memberships = await prisma.membership.findMany({
    where: { tenantId: ctx.tenantId, personId: { in: persons.map((p) => p.id) } },
    select: { personId: true, role: true },
  });
  const existingMembership = new Set(memberships.map((m) => `${m.personId}|${m.role}`));

  let willCreate = 0;
  let willUpdate = 0;
  for (const r of planRows) {
    const pid = personIdByPhone.get(r.phone);
    if (pid && existingMembership.has(`${pid}|${r.role}`)) willUpdate++;
    else willCreate++;
  }

  const apply = async (tx: Prisma.TransactionClient) => {
    let created = 0;
    let updated = 0;
    for (const r of planRows) {
      // Reuse an existing Person; only set name/email when creating a new
      // identity (never clobber what other tenants depend on) — mirrors
      // members.service.create.
      const person = await tx.person.upsert({
        where: { phone: r.phone },
        update: {},
        create: { phone: r.phone, name: r.name, email: r.email },
      });
      const existed = await tx.membership.findUnique({
        where: { personId_tenantId_role: { personId: person.id, tenantId: ctx.tenantId, role: r.role as Role } },
        select: { id: true },
      });
      await tx.membership.upsert({
        where: { personId_tenantId_role: { personId: person.id, tenantId: ctx.tenantId, role: r.role as Role } },
        update: { status: 'ACTIVE' },
        create: { personId: person.id, tenantId: ctx.tenantId, role: r.role as Role, status: 'ACTIVE' },
      });
      if (existed) updated++; else created++;
    }
    return { created, updated };
  };

  return { errors, willCreate, willUpdate, apply };
};

// ─── students ───────────────────────────────────────────────────────────────

const studentsImporter: Importer = async (prisma, ctx, rows) => {
  const errors: RowError[] = [];

  const ageGroups = await prisma.ageGroup.findMany({ where: { tenantId: ctx.tenantId }, select: { id: true, name: true } });
  const ageGroupByName = new Map(ageGroups.map((a) => [norm(a.name), a.id]));

  const routes = await prisma.route.findMany({
    where: { tenantId: ctx.tenantId },
    select: { id: true, name: true, vehicle: { select: { capacity: true } } },
  });
  const routeByName = new Map(routes.map((r) => [norm(r.name), r.id]));
  // Seat capacity per route from its designated bus (null → no limit to enforce).
  const capacityByRoute = new Map(routes.map((r) => [r.id, r.vehicle?.capacity ?? null]));

  const stops = await prisma.stop.findMany({ where: { tenantId: ctx.tenantId }, select: { id: true, name: true } });
  const stopByName = new Map(stops.map((s) => [norm(s.name), s.id]));

  // Which stops belong to which route (so a child is pinned to a stop ON its route).
  const routeStops = await prisma.routeStop.findMany({
    where: { route: { tenantId: ctx.tenantId } },
    select: { routeId: true, stopId: true },
  });
  const stopsByRoute = new Map<string, Set<string>>();
  for (const rs of routeStops) {
    if (!stopsByRoute.has(rs.routeId)) stopsByRoute.set(rs.routeId, new Set());
    stopsByRoute.get(rs.routeId)!.add(rs.stopId);
  }

  const existingStudents = await prisma.student.findMany({
    where: { tenantId: ctx.tenantId, regId: { not: null } },
    select: { id: true, regId: true, status: true },
  });
  const studentIdByReg = new Map(existingStudents.map((s) => [norm(s.regId as string), s.id]));
  // Status of each known student (by regId) — an INACTIVE student an update touches
  // keeps its status, so it doesn't occupy a seat for the capacity projection.
  const statusByReg = new Map(existingStudents.map((s) => [norm(s.regId as string), s.status]));

  // Seat-capacity projection (FR fleet-integrity §1): start from students NOT in
  // this file (they keep their seat), then add each file row as it's planned. A row
  // that would push a route past its bus capacity becomes a row error, never an
  // overfill. Students this file re-assigns (regId present) are excluded from the
  // baseline because the file's assignment supersedes their current one.
  const fileRegIds = new Set(
    rows.map((r) => r.values.regId?.trim()).filter((v): v is string => !!v).map(norm),
  );
  const activeAssigned = await prisma.student.findMany({
    where: { tenantId: ctx.tenantId, status: 'ACTIVE', routeId: { not: null } },
    select: { regId: true, routeId: true },
  });
  const occupancy = new Map<string, number>();
  for (const s of activeAssigned) {
    if (s.regId && fileRegIds.has(norm(s.regId))) continue; // superseded by this file
    occupancy.set(s.routeId as string, (occupancy.get(s.routeId as string) ?? 0) + 1);
  }

  const seenReg = new Set<string>();
  let willCreate = 0;
  let willUpdate = 0;
  interface PlanRow {
    name: string; regId?: string; ageGroupId: string;
    routeId?: string; stopId?: string;
    parentName?: string; parentPhone?: string; relation?: string;
  }
  const planRows: PlanRow[] = [];

  for (const row of rows) {
    const before = errors.length;
    const name = req(row, 'name', errors);

    const ageGroupName = req(row, 'ageGroupName', errors);
    let ageGroupId: string | undefined;
    if (ageGroupName) {
      ageGroupId = ageGroupByName.get(norm(ageGroupName));
      if (!ageGroupId) errors.push({ row: row.rowNumber, field: 'ageGroupName', message: `age group "${ageGroupName}" does not exist — import age groups first` });
    }

    let routeId: string | undefined;
    const routeName = row.values.routeName?.trim();
    if (routeName) {
      routeId = routeByName.get(norm(routeName));
      if (!routeId) errors.push({ row: row.rowNumber, field: 'routeName', message: `route "${routeName}" does not exist — import routes first` });
    }

    let stopId: string | undefined;
    const stopName = row.values.stopName?.trim();
    if (stopName) {
      stopId = stopByName.get(norm(stopName));
      if (!stopId) errors.push({ row: row.rowNumber, field: 'stopName', message: `stop "${stopName}" does not exist — import routes & stops first` });
      else if (routeId && !(stopsByRoute.get(routeId)?.has(stopId))) errors.push({ row: row.rowNumber, field: 'stopName', message: `stop "${stopName}" is not on route "${routeName}"` });
      else if (!routeId) errors.push({ row: row.rowNumber, field: 'routeName', message: 'routeName is required when a stop is given' });
    }

    // Guardian phone optional, but if present must be valid.
    let parentPhone: string | undefined;
    if (row.values.parentPhone?.trim()) {
      const p = phone(row, 'parentPhone', errors);
      if (p) parentPhone = p;
    }

    const regId = row.values.regId?.trim() || undefined;
    if (regId) {
      const rk = norm(regId);
      if (seenReg.has(rk)) {
        errors.push({ row: row.rowNumber, field: 'regId', message: `duplicate regId "${regId}" in the file` });
        continue;
      }
      seenReg.add(rk);
    }

    if (errors.length > before || !name || !ageGroupId) continue;

    // Over-capacity guard: only seats that will actually be occupied count — a new
    // student (created ACTIVE) or an update to a student that's already ACTIVE.
    if (routeId) {
      const regKey = regId ? norm(regId) : null;
      const isUpdate = regKey ? statusByReg.has(regKey) : false;
      const willOccupy = isUpdate ? statusByReg.get(regKey as string) === 'ACTIVE' : true;
      const cap = capacityByRoute.get(routeId) ?? null;
      if (willOccupy && cap != null) {
        const used = occupancy.get(routeId) ?? 0;
        if (used + 1 > cap) {
          errors.push({
            row: row.rowNumber,
            field: 'routeName',
            message: `route "${routeName}" bus is full (${used}/${cap}) — this row would over-fill it`,
          });
          continue;
        }
        occupancy.set(routeId, used + 1);
      }
    }

    planRows.push({
      name, regId, ageGroupId, routeId, stopId,
      parentName: row.values.parentName?.trim() || undefined,
      parentPhone,
      relation: row.values.relation?.trim() || undefined,
    });

    if (regId && studentIdByReg.has(norm(regId))) willUpdate++;
    else willCreate++;
  }

  const apply = async (tx: Prisma.TransactionClient) => {
    let created = 0;
    let updated = 0;
    for (const r of planRows) {
      // Find an existing student by (tenant, regId) to update; else create.
      let studentId: string | null = null;
      if (r.regId) {
        const existing = await tx.student.findUnique({
          where: { tenantId_regId: { tenantId: ctx.tenantId, regId: r.regId } },
          select: { id: true },
        });
        studentId = existing?.id ?? null;
      }

      if (studentId) {
        await tx.student.update({
          where: { id: studentId },
          data: { name: r.name, ageGroupId: r.ageGroupId, routeId: r.routeId ?? null, stopId: r.stopId ?? null },
        });
        updated++;
      } else {
        const student = await tx.student.create({
          data: {
            tenantId: ctx.tenantId, name: r.name, regId: r.regId,
            ageGroupId: r.ageGroupId, routeId: r.routeId, stopId: r.stopId,
          },
        });
        studentId = student.id;
        created++;
      }

      // Guardian linkage — Person (global, idempotent on phone) + ACTIVE PARENT
      // membership + Guardianship, mirroring students.service.create.
      if (r.parentPhone) {
        const person = await tx.person.upsert({
          where: { phone: r.parentPhone },
          update: r.parentName ? { name: r.parentName } : {},
          create: { phone: r.parentPhone, name: r.parentName ?? r.parentPhone },
        });
        await tx.membership.upsert({
          where: { personId_tenantId_role: { personId: person.id, tenantId: ctx.tenantId, role: 'PARENT' as Role } },
          update: { status: 'ACTIVE' },
          create: { personId: person.id, tenantId: ctx.tenantId, role: 'PARENT' as Role, status: 'ACTIVE' },
        });
        await tx.guardianship.upsert({
          where: { studentId_personId: { studentId, personId: person.id } },
          update: {},
          create: { studentId, personId: person.id, relation: r.relation ?? 'PARENT', isPrimary: true },
        });
      }
    }
    return { created, updated };
  };

  return { errors, willCreate, willUpdate, apply };
};

export const IMPORTERS: Record<ImportEntityType, Importer> = {
  routes_stops: routesStopsImporter,
  age_groups: ageGroupsImporter,
  vehicles: vehiclesImporter,
  staff: staffImporter,
  students: studentsImporter,
};

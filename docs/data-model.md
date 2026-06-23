# Yaanam MVP — Data Model Documentation

This document describes the database schema designed for the Yaanam platform. The schema is built using PostgreSQL and managed with Prisma.

---

## Entity Relationship Overview

The data model is divided into the following key domains:
1. **Identity**: Persons, Tenants, Memberships, Students, and Consent.
2. **Vehicles & Routes**: Vehicles, Routes, Stops, RouteStops, and VehicleAssignments.
3. **Trips & Tracking**: Trips, TripRiders, LocationPings, GeofenceEvents, SpeedEvents, and AttendanceEvents.
4. **Notifications**: DeviceTokens, NotificationPreferences, and Notifications.
5. **Complaints**: Complaints, ComplaintEvents, ResolutionRatings, and Attachments.
6. **Payments**: FeePlans, Invoices, Payments, Mandates, and Webhooks.

---

## Identity Domain

### `Person`
Represents an individual user of the platform (parent, driver, administrator, teacher, etc.).
- **Primary Key**: `id` (UUID)
- **Unique Fields**: `phone` (standardized string, e.g. `+919999000001`)
- **Relations**: Has many `Membership`, `Guardianship`, `DeviceToken`, `Consent`, and `NotificationPreference`.

### `Tenant`
Represents a school, educational institution, or transport service operator (e.g. "Sunrise International School").
- **Primary Key**: `id` (UUID)
- **Fields**: `name`, `timezone`, `locale`, `featureFlags` (JSON), `brandingConfig` (JSON), `status` (ACTIVE/INACTIVE).
- **Relations**: Holds children registries for `Membership`, `Student`, `Vehicle`, `Route`, `Trip`, etc.

### `Membership`
Maps a `Person` to a `Tenant` with a specific `Role`. A person can have multiple memberships (e.g., parent in one school, administrator in another).
- **Composite Unique Constraint**: `[personId, tenantId, role]`
- **Roles**:
  - `PARENT`
  - `TEACHER_RIDER`
  - `DRIVER`
  - `CONDUCTOR`
  - `ADMIN`
  - `TRANSPORT_MANAGER`
  - `SUPER_ADMIN`

### `Student`
Represents a student registered under a tenant, assigned to a route and stop.
- **Fields**: `name`, `regId` (registration ID), `ageGroupId`, `routeId` (nullable), `stopId` (nullable).
- **Relations**: Belongs to `Tenant`, `AgeGroup`, `Route`, and `Stop`. Has many `Guardianship` records mapping parents to the student.

---

## Vehicles & Routes Domain

### `Vehicle`
Represents a bus, van, or transport vehicle in the tenant's fleet.
- **Unique Constraints**: `[tenantId, regNumber]`
- **Fields**: `regNumber` (registration number), `capacity`, `type` (e.g., BUS), `status` (ACTIVE/INACTIVE/MAINTENANCE).

### `Route`
Defines a transit route (pickup or drop).
- **Fields**: `name`, `direction` (PICKUP/DROP), `status` (ACTIVE/INACTIVE).
- **Relations**: Contains many `RouteStop` relationships.

### `Stop`
Represents a geographical pickup/drop stop with coordinates.
- **Fields**: `name`, `lat` (Latitude), `lng` (Longitude), `geofenceRadius` (meters, default 100).

### `RouteStop`
A junction table mapping a `Stop` onto a `Route` with a specific order sequence.
- **Composite Unique Constraint**: `[routeId, sequence]`
- **Fields**: `sequence` (1-indexed order).

---

## Trips & Tracking Domain

### `Trip`
A runtime execution instance of a specific `Route` using a `Vehicle` on a specific `Date`.
- **Statuses**: `SCHEDULED`, `STARTED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `ABORTED`.
- **Fields**: `startedAt` (timestamp), `completedAt` (timestamp).
- **Relations**: Has many `TripRider` (student manifest), `LocationPing` (GPS log), `AttendanceEvent`, etc.

### `LocationPing`
High-frequency GPS logging records from the active trip.
- **Indexes**: `[tripId, deviceTs]`
- **Fields**: `lat`, `lng`, `accuracy`, `speed`, `deviceTs` (GPS clock), `sequence` (incrementing counter).

### `AttendanceEvent`
Captures student boarding and alighting logs verified by biometric/driver check.
- **Fields**: `type` (BOARDED/ALIGHTED), `photoUrl` (optional verification), `markedBy` (Membership ID), `ts` (timestamp).

---

## Payments Domain

### `Invoice`
A generated fee invoice for a student under a tenant.
- **Statuses**: `GENERATED`, `DUE`, `PAID`, `OVERDUE`, `CANCELLED`
- **Fields**: `amountPaise` (total fee amount in lowest currency unit), `dueDate`, `paidAt`.

### `Mandate`
Autopay registration (UPI Autopay, eNACH) for recurring transport subscriptions.
- **Statuses**: `CREATED`, `PENDING`, `ACTIVE`, `PAUSED`, `REVOKED`, `EXPIRED`, `FAILED`
- **Types**: `UPI_AUTOPAY`, `ENACH`

---

## Complaints Domain

### `Complaint`
Tickets raised by parents regarding delays, drivers, safety concerns, or invoicing.
- **Statuses**: `RECEIVED`, `IN_PROGRESS`, `COUNSELLING_CALL`, `ADMIN_CALL`, `RESOLVED`, `CLOSED`, `REOPENED`
- **Fields**: `category` (e.g., TIMING_DELAY, ACCIDENT, DRIVER_BEHAVIOR), `severity` (LOW, MEDIUM, HIGH), `slaDeadline`, `resolvedAt`.

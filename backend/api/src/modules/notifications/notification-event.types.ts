import { NotifCategory, NotifChannel } from '@saarthi/types';

/**
 * Relative urgency of an event. Drives nothing in the engine yet (all channels
 * fire immediately) but is recorded on the spec so quiet-hours / throttle logic
 * can branch on it later without touching call sites.
 */
export enum NotifPriority {
  SAFETY_CRITICAL = 'SAFETY_CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
}

type Vars = Record<string, string>;

export interface NotificationEventSpec {
  /** Matches a NotifCategory in @saarthi/types — never invent new categories. */
  eventType: NotifCategory;
  /** Channels to attempt, in order. PUSH is real; SMS/WHATSAPP are stubs. */
  channels: NotifChannel[];
  /** Redis dedup TTL: a repeat of the same (eventType, entityId, recipient) inside this window is dropped. */
  dedupWindowMs: number;
  priority: NotifPriority;
  /** Stored on Notification.templateId so the audit/feed can group by template. */
  templateId: string;
  /**
   * Recipient resolution happens at the call site (services already hold the
   * prisma queries to resolve guardians/admins). This is the documented intent
   * of who each event targets — kept here so the registry stays self-describing.
   */
  recipients: string;
  /** Render the push/feed title from the dispatch variables. */
  title: (vars: Vars) => string;
  /** Render the push/feed body from the dispatch variables. */
  body: (vars: Vars) => string;
}

const v = (vars: Vars, key: string, fallback = ''): string => vars[key] ?? fallback;

/**
 * The single source of truth for what each event does. dispatch() looks the
 * eventType up here; if there is no spec it logs and no-ops (never throws).
 */
export const NOTIFICATION_EVENT_SPECS: Record<NotifCategory, NotificationEventSpec | undefined> = {
  [NotifCategory.BOARDING]: {
    eventType: NotifCategory.BOARDING,
    channels: [NotifChannel.PUSH, NotifChannel.SMS],
    dedupWindowMs: 60_000,
    priority: NotifPriority.SAFETY_CRITICAL,
    templateId: 'boarding.v1',
    recipients: 'guardians of studentId',
    title: () => 'Boarded the bus',
    body: (vars) => `${v(vars, 'studentName', 'Your child')} boarded${v(vars, 'stopName') ? ` at ${v(vars, 'stopName')}` : ''}.`,
  },
  // NOT_BOARDED maps to ALIGHTING — the closest existing category in the enum.
  [NotifCategory.ALIGHTING]: {
    eventType: NotifCategory.ALIGHTING,
    channels: [NotifChannel.PUSH, NotifChannel.SMS],
    dedupWindowMs: 60_000,
    priority: NotifPriority.SAFETY_CRITICAL,
    templateId: 'not-boarded.v1',
    recipients: 'guardians of studentId + tenant admins',
    title: () => 'Did not board',
    body: (vars) => `${v(vars, 'studentName', 'Your child')} did not board${v(vars, 'stopName') ? ` at ${v(vars, 'stopName')}` : ''}.`,
  },
  [NotifCategory.TRIP_START]: {
    eventType: NotifCategory.TRIP_START,
    channels: [NotifChannel.PUSH],
    dedupWindowMs: 300_000,
    priority: NotifPriority.MEDIUM,
    templateId: 'trip-start.v1',
    recipients: 'all guardians on trip',
    title: () => 'Trip started',
    body: () => 'The bus has started its trip.',
  },
  // Trip-start governance (2B): raised when a driver starts a trip outside the
  // clean-start rule. Targets tenant admins so they can review/resolve the alarm.
  [NotifCategory.TRIP_START_EXCEPTION]: {
    eventType: NotifCategory.TRIP_START_EXCEPTION,
    channels: [NotifChannel.PUSH],
    dedupWindowMs: 60_000,
    priority: NotifPriority.HIGH,
    templateId: 'trip-start-exception.v1',
    recipients: 'tenant admins',
    title: () => 'Trip started off-protocol',
    body: (vars) =>
      `A trip started outside the rules${v(vars, 'reason') ? ` — ${v(vars, 'reason')}` : ''}.`,
  },
  // Early-completion exception: a driver completed a trip before its final stop.
  // Targets tenant admins so they review/resolve the alarm from the same panel.
  [NotifCategory.TRIP_EARLY_COMPLETE]: {
    eventType: NotifCategory.TRIP_EARLY_COMPLETE,
    channels: [NotifChannel.PUSH],
    dedupWindowMs: 60_000,
    priority: NotifPriority.HIGH,
    templateId: 'trip-early-complete.v1',
    recipients: 'tenant admins',
    title: () => 'Trip completed early',
    body: (vars) =>
      `A trip was completed before its final stop${v(vars, 'reason') ? ` — ${v(vars, 'reason')}` : ''}.`,
  },
  // Never-started anomaly: a trip still SCHEDULED >12h past its planned start.
  // Targets tenant admins. The dedup window is a full day so a trip that stays
  // overdue (read-computed on each alarm-panel load) pings admins at most once
  // per day rather than on every read.
  [NotifCategory.TRIP_NOT_STARTED]: {
    eventType: NotifCategory.TRIP_NOT_STARTED,
    channels: [NotifChannel.PUSH],
    dedupWindowMs: 86_400_000,
    priority: NotifPriority.HIGH,
    templateId: 'trip-not-started.v1',
    recipients: 'tenant admins',
    title: () => 'Trip never started',
    body: (vars) =>
      `${v(vars, 'routeName', 'A trip')} is still scheduled ${v(vars, 'overdueHours') ? `${v(vars, 'overdueHours')}h ` : ''}past its start time.`,
  },
  [NotifCategory.TRIP_END]: {
    eventType: NotifCategory.TRIP_END,
    channels: [NotifChannel.PUSH],
    dedupWindowMs: 300_000,
    priority: NotifPriority.MEDIUM,
    templateId: 'trip-end.v1',
    recipients: 'all guardians on trip',
    title: () => 'Trip completed',
    body: () => 'The bus has completed its trip.',
  },
  // Arrival alarms (PRD-03 §4.1). The dedup window is generous (1h) so a single
  // approach to a stop fires each stage once — entityId carries (trip, stop), so
  // a different stop or a different trip is a different dedup key.
  [NotifCategory.ARRIVAL_5MIN]: {
    eventType: NotifCategory.ARRIVAL_5MIN,
    channels: [NotifChannel.PUSH, NotifChannel.SMS],
    dedupWindowMs: 3_600_000,
    priority: NotifPriority.HIGH,
    templateId: 'arrival-5min.v1',
    recipients: 'guardians of riders whose stop this is',
    title: () => 'Bus is ~5 min away',
    body: (vars) => `The bus is about 5 minutes from ${v(vars, 'stopName', 'your stop')}.`,
  },
  [NotifCategory.ARRIVAL_1MIN]: {
    eventType: NotifCategory.ARRIVAL_1MIN,
    channels: [NotifChannel.PUSH],
    dedupWindowMs: 3_600_000,
    priority: NotifPriority.HIGH,
    templateId: 'arrival-1min.v1',
    recipients: 'guardians of riders whose stop this is',
    title: () => 'Bus is ~1 min away',
    body: (vars) =>
      `The bus is about a minute from ${v(vars, 'stopName', 'your stop')}. Please be ready.`,
  },
  // Arrived is safety-critical (overrides channel-off prefs / quiet hours per FR-13).
  [NotifCategory.ARRIVED]: {
    eventType: NotifCategory.ARRIVED,
    channels: [NotifChannel.PUSH, NotifChannel.SMS],
    dedupWindowMs: 3_600_000,
    priority: NotifPriority.SAFETY_CRITICAL,
    templateId: 'arrived.v1',
    recipients: 'guardians of riders whose stop this is',
    title: () => 'Bus has arrived',
    body: (vars) => `The bus has arrived at ${v(vars, 'stopName', 'your stop')}.`,
  },
  [NotifCategory.PICKUP_CANCELLED]: {
    eventType: NotifCategory.PICKUP_CANCELLED,
    channels: [NotifChannel.PUSH],
    dedupWindowMs: 60_000,
    priority: NotifPriority.HIGH,
    templateId: 'pickup-cancelled.v1',
    recipients: 'driver + tenant admins',
    title: () => 'Pickup cancelled',
    body: (vars) => `A pickup was cancelled${v(vars, 'studentName') ? ` for ${v(vars, 'studentName')}` : ''}.`,
  },
  [NotifCategory.COMPLAINT_UPDATE]: {
    eventType: NotifCategory.COMPLAINT_UPDATE,
    channels: [NotifChannel.PUSH],
    dedupWindowMs: 300_000,
    priority: NotifPriority.MEDIUM,
    templateId: 'complaint-update.v1',
    recipients: 'guardian who filed the complaint',
    title: (vars) => v(vars, 'status') === 'RESOLVED' ? 'Complaint resolved' : 'Complaint update',
    body: (vars) =>
      v(vars, 'note')
        ? `Your complaint was resolved: ${v(vars, 'note')}`
        : `Your complaint is now ${v(vars, 'status', 'updated')}.`,
  },
  [NotifCategory.PAYMENT_DUE]: {
    eventType: NotifCategory.PAYMENT_DUE,
    channels: [NotifChannel.PUSH],
    dedupWindowMs: 3_600_000,
    priority: NotifPriority.MEDIUM,
    templateId: 'payment-due.v1',
    recipients: 'guardian on the invoice',
    title: () => 'Payment due',
    body: (vars) => `An invoice${v(vars, 'amount') ? ` of ${v(vars, 'amount')}` : ''} is due.`,
  },
  [NotifCategory.PAYMENT_SUCCESS]: {
    eventType: NotifCategory.PAYMENT_SUCCESS,
    channels: [NotifChannel.PUSH],
    dedupWindowMs: 300_000,
    priority: NotifPriority.MEDIUM,
    templateId: 'payment-success.v1',
    recipients: 'guardian on the invoice',
    title: () => 'Payment successful',
    body: (vars) => `Payment${v(vars, 'amount') ? ` of ${v(vars, 'amount')}` : ''} received. Thank you.`,
  },
  // OVERSPEED exists in the enum but has no spec in this phase — dispatch() no-ops it.
  [NotifCategory.OVERSPEED]: undefined,
};

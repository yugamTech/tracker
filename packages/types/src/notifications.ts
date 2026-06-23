export enum NotifChannel {
  PUSH = 'PUSH',
  SMS = 'SMS',
  WHATSAPP = 'WHATSAPP',
}

export enum NotifStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
}

export enum NotifCategory {
  TRIP_START = 'TRIP_START',
  TRIP_START_EXCEPTION = 'TRIP_START_EXCEPTION',
  // Raised when a driver completes a trip before reaching its final stop. Targets
  // tenant admins so they can review/resolve the early-completion alarm.
  TRIP_EARLY_COMPLETE = 'TRIP_EARLY_COMPLETE',
  // Raised when a trip is still SCHEDULED well past its planned start (12h) — a
  // never-started anomaly the admin must review. Targets tenant admins.
  TRIP_NOT_STARTED = 'TRIP_NOT_STARTED',
  // Stage-1 (soft) of the started-not-completed mechanism (PRD-02a): a live trip
  // is past its overdue cutoff. Trip stays live; targets tenant admins.
  TRIP_OVERDUE = 'TRIP_OVERDUE',
  // Stage-2 (hard) of the started-not-completed mechanism (PRD-02a): a live trip
  // was auto-aborted as abandoned. Targets tenant admins.
  TRIP_ABANDONED = 'TRIP_ABANDONED',
  TRIP_END = 'TRIP_END',
  // Per-rider arrival alarms (PRD-03 §4.1): the bus is ~5 min / ~1 min from a
  // rider's stop, or has arrived at it.
  ARRIVAL_5MIN = 'ARRIVAL_5MIN',
  ARRIVAL_1MIN = 'ARRIVAL_1MIN',
  ARRIVED = 'ARRIVED',
  BOARDING = 'BOARDING',
  ALIGHTING = 'ALIGHTING',
  PICKUP_CANCELLED = 'PICKUP_CANCELLED',
  OVERSPEED = 'OVERSPEED',
  COMPLAINT_UPDATE = 'COMPLAINT_UPDATE',
  PAYMENT_DUE = 'PAYMENT_DUE',
  PAYMENT_SUCCESS = 'PAYMENT_SUCCESS',
}

export interface Notification {
  id: string;
  tenantId: string;
  eventType: string;
  recipientId: string;
  channel: NotifChannel;
  status: NotifStatus;
  templateId: string;
  variables: Record<string, string>;
  dedupKey?: string;
  createdAt: string;
  sentAt?: string;
  deliveredAt?: string;
}

export interface NotificationPreference {
  id: string;
  personId: string;
  tenantId: string;
  category: NotifCategory;
  push: boolean;
  sms: boolean;
  whatsapp: boolean;
}

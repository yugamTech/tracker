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
  TRIP_END = 'TRIP_END',
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

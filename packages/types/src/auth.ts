export enum Role {
  PARENT = 'PARENT',
  TEACHER_RIDER = 'TEACHER_RIDER',
  // Teacher/staff who rides a route to supervise children (lightweight
  // "who's aboard" association — not a billed rider, not trip crew).
  TEACHER = 'TEACHER',
  DRIVER = 'DRIVER',
  CONDUCTOR = 'CONDUCTOR',
  ADMIN = 'ADMIN',
  TRANSPORT_MANAGER = 'TRANSPORT_MANAGER',
  FOUNDER = 'FOUNDER',
  SUPER_ADMIN = 'SUPER_ADMIN',
}

export enum PersonStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export enum MembershipStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export enum PoliceVerificationStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
}

// Driver KYC (text only). Aadhaar is sensitive personal data — DPDP: encrypt/mask
// before production. Document-image upload is out of scope this milestone; photoUrl
// is a plain optional URL for when object storage lands later.
export interface DriverProfile {
  id: string;
  tenantId: string;
  membershipId: string;
  aadhaarNumber?: string | null;
  address?: string | null;
  licenseNumber?: string | null;
  licenseExpiry?: string | null;
  policeVerificationStatus: PoliceVerificationStatus;
  policeVerificationRef?: string | null;
  photoUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Person {
  id: string;
  phone: string;
  name: string;
  email?: string;
  locale: string;
  status: PersonStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Membership {
  id: string;
  personId: string;
  tenantId: string;
  role: Role;
  status: MembershipStatus;
  createdAt: string;
}

export interface JwtPayload {
  sub: string;          // person_id
  membershipId: string;
  tenantId: string;
  role: Role;
  iat: number;
  exp: number;
}

export interface ActiveMembership {
  personId: string;
  membershipId: string;
  tenantId: string;
  tenantName?: string;
  role: Role;
}

export interface Tenant {
  id: string;
  name: string;
  timezone: string;
  locale: string;
  featureFlags: Record<string, unknown>;
  brandingConfig: Record<string, unknown>;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
}

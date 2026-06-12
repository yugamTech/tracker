export declare enum InvoiceStatus {
    GENERATED = "GENERATED",
    DUE = "DUE",
    PAID = "PAID",
    OVERDUE = "OVERDUE",
    CANCELLED = "CANCELLED"
}
export declare enum PaymentStatus {
    INITIATED = "INITIATED",
    SUCCESS = "SUCCESS",
    FAILED = "FAILED",
    REFUNDED = "REFUNDED"
}
export declare enum MandateType {
    UPI_AUTOPAY = "UPI_AUTOPAY",
    ENACH = "ENACH"
}
export declare enum MandateStatus {
    CREATED = "CREATED",
    PENDING = "PENDING",
    ACTIVE = "ACTIVE",
    PAUSED = "PAUSED",
    REVOKED = "REVOKED",
    EXPIRED = "EXPIRED",
    FAILED = "FAILED"
}
export interface Invoice {
    id: string;
    tenantId: string;
    invoiceNo: string;
    studentId: string;
    feePlanId: string;
    amountPaise: number;
    taxPaise: number;
    dueDate: string;
    status: InvoiceStatus;
    createdAt: string;
    paidAt?: string;
}
export interface Payment {
    id: string;
    tenantId: string;
    invoiceId: string;
    gateway: string;
    gatewayOrderId: string;
    gatewayPaymentId?: string;
    amountPaise: number;
    status: PaymentStatus;
    createdAt: string;
    confirmedAt?: string;
}
export interface Mandate {
    id: string;
    tenantId: string;
    studentId: string;
    guardianId: string;
    gateway: string;
    gatewayMandateId?: string;
    type: MandateType;
    amountCapPaise: number;
    status: MandateStatus;
    createdAt: string;
    activatedAt?: string;
    revokedAt?: string;
}
export interface FeePlan {
    id: string;
    tenantId: string;
    name: string;
    amountPaise: number;
    cycleMonths: number;
    applicableTo: string;
    effectiveFrom: string;
    effectiveTo?: string;
    taxPercent: number;
}
//# sourceMappingURL=payments.d.ts.map
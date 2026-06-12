export declare enum ComplaintStatus {
    RECEIVED = "RECEIVED",
    IN_PROGRESS = "IN_PROGRESS",
    COUNSELLING_CALL = "COUNSELLING_CALL",
    ADMIN_CALL = "ADMIN_CALL",
    RESOLVED = "RESOLVED",
    PARENT_RATING = "PARENT_RATING",
    VISIT = "VISIT",
    CLOSED = "CLOSED",
    REOPENED = "REOPENED"
}
export declare enum ComplaintCategory {
    BEHAVIOUR = "BEHAVIOUR",
    SAFETY = "SAFETY",
    TIMING = "TIMING",
    VEHICLE_CONDITION = "VEHICLE_CONDITION",
    ROUTE_ISSUE = "ROUTE_ISSUE",
    OTHER = "OTHER"
}
export interface Complaint {
    id: string;
    tenantId: string;
    raisedBy: string;
    studentId?: string;
    tripId?: string;
    category: ComplaintCategory;
    description?: string;
    status: ComplaintStatus;
    ownerId?: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    slaDeadline?: string;
    createdAt: string;
    resolvedAt?: string;
}
export interface ComplaintEvent {
    id: string;
    complaintId: string;
    actor: string;
    fromStatus: ComplaintStatus;
    toStatus: ComplaintStatus;
    note?: string;
    ts: string;
}
//# sourceMappingURL=complaints.d.ts.map
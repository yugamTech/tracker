export declare enum AttendanceType {
    BOARDED = "BOARDED",
    ALIGHTED = "ALIGHTED"
}
export interface AttendanceEvent {
    id: string;
    tripId: string;
    studentId: string;
    tenantId: string;
    type: AttendanceType;
    photoUrl?: string;
    markedBy: string;
    ts: string;
}
export interface Student {
    id: string;
    tenantId: string;
    name: string;
    regId?: string;
    ageGroupId: string;
    routeId?: string;
    stopId?: string;
    status: 'ACTIVE' | 'INACTIVE';
    createdAt: string;
}
export interface Guardianship {
    id: string;
    studentId: string;
    personId: string;
    relation: string;
    isPrimary: boolean;
}
//# sourceMappingURL=attendance.d.ts.map
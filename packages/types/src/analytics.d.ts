export interface MetricSnapshot {
    id: string;
    tenantId: string;
    date: string;
    metrics: Record<string, number | string>;
    createdAt: string;
}
export interface AgentPost {
    id: string;
    feedId: string;
    date: string;
    metricSnapshotId: string;
    generatedText: string;
    createdAt: string;
}
export interface AgentFeed {
    id: string;
    tenantId: string;
    name: string;
}
export interface DashboardKpi {
    activeTrips: number;
    totalRiders: number;
    boardedCount: number;
    notBoardedCount: number;
    overSpeedAlerts: number;
    openComplaints: number;
    collectionRate: number;
}
//# sourceMappingURL=analytics.d.ts.map
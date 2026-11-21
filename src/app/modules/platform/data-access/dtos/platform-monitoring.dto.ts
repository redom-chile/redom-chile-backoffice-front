/** Monitoreo de las APIs (backend: libs/billing/monitoring, C42). Mantener igual. */
export type MonitoredService = 'auth' | 'restaurant' | 'billing';
export type ServiceStatus = 'up' | 'degraded' | 'down' | 'unknown';
export type MonitoringRange = '24h' | '7d' | '30d';

export type LastCheckDto = Readonly<{
  ok: boolean;
  // true: también revisó la base de datos (solo con sospecha o «Chequear ahora»)
  deep: boolean;
  checkedAt: string;
  latencyMs: number;
  databaseMs: number | null;
  redisMs: number | null;
  error: string | null;
}>;

export type ServiceHealthDto = Readonly<{
  service: MonitoredService;
  status: ServiceStatus;
  lastCheck: LastCheckDto | null;
  lastDeepCheck: LastCheckDto | null;
  uptime: Readonly<{ last24h: number | null; last7d: number | null; last30d: number | null }>;
  latencyAvgMs: number | null;
  slowChecks: number;
  requests: Readonly<{ total: number; errors: number; slow: number }>;
}>;

export type LatencyPointDto = Readonly<{
  at: string;
  service: MonitoredService;
  avgMs: number | null;
  checks: number;
  failed: number;
}>;

/** Algo se vio mal: se revisa también la base hasta `until`. */
export type SuspicionDto = Readonly<{ since: string; until: string; reason: string }>;

export type RequestPointDto = Readonly<{
  at: string;
  service: MonitoredService;
  total: number;
  errors: number;
  slow: number;
}>;

export type IncidentDto = Readonly<{
  id: number;
  service: MonitoredService;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
  cause: string;
  lastError: string | null;
  failedChecks: number;
}>;

export type RouteIssueDto = Readonly<{ service: MonitoredService; route: string; errors: number; slow: number }>;

export type MonitoringOverviewDto = Readonly<{
  range: MonitoringRange;
  generatedAt: string;
  lastCheckAt: string | null;
  checkerHealthy: boolean;
  checkIntervalMinutes: number;
  suspicion: SuspicionDto | null;
  bucketMinutes: number;
  requestBucketMinutes: number;
  services: ServiceHealthDto[];
  latency: LatencyPointDto[];
  requests: RequestPointDto[];
  incidents: IncidentDto[];
  routes: RouteIssueDto[];
}>;

export type HealthProbeDto = Readonly<{
  service: MonitoredService;
  deep: boolean;
  ok: boolean;
  statusCode: number | null;
  latencyMs: number;
  databaseMs: number | null;
  redisMs: number | null;
  error: string | null;
}>;

export type MonitoringRunDto = Readonly<{
  checkedAt: string;
  mode: 'light' | 'deep';
  suspicion: SuspicionDto | null;
  probes: HealthProbeDto[];
  incidentsOpened: MonitoredService[];
  incidentsClosed: MonitoredService[];
}>;

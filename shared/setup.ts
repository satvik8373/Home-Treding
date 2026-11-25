export type EgressMode = 'direct' | 'proxy' | 'interface'
export interface NetworkProfile { primary: string; secondary: string | null; savedAt: number }
export interface ExecutionSetup {
  location: 'hosted' | 'local' | 'unspecified';
  observed: { ipv4: string; checkedAt: number; changed: boolean } | null;
  current: boolean;
  error: string | null;
  expectedIPv4: string | null;
  expectedMatch: boolean | null;
  account: string | null;
  connectionScope: string | null;
  profile: NetworkProfile | null;
  registeredMatch: boolean | null;
  registrationSource: 'user-entered';
  brokerRegistrationVerified: false;
  egressMode?: EgressMode;
  proxyConfigured?: boolean;
  proxyLabel?: string | null;
  sharedIpConflict?: boolean;
  dedicatedRouteRequired?: boolean;
  assignmentReleased?: boolean;
  assignmentManaged?: boolean;
}

/** Older engines report a direct-host conflict without the assignment flag. */
export function executionRouteUnassigned(report: ExecutionSetup | null): boolean {
  if (!report) return false
  const mode = report.egressMode ?? (report.proxyConfigured ? 'proxy' : 'direct')
  return !!report.dedicatedRouteRequired || mode === 'direct' && !!report.sharedIpConflict
}

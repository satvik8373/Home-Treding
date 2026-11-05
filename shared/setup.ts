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
}

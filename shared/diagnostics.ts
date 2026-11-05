export interface BrokerCheck {
  name: string;
  status: 'pass' | 'warning' | 'failed' | 'untested';
  detail: string;
  durationMs: number;
  helpUrl?: string;
}
export interface BrokerDiagnostics {
  account: string;
  checkedAt: number;
  expiresAt: number;
  checks: BrokerCheck[];
  funds: { segment: string; available: number | null; utilized: number | null }[];
  positions: { symbol: string; exchange: string; product: string; quantity: number }[];
  orders: { id: string; symbol: string; side: string; quantity: number | null; filled: number | null; average: number | null; status: string; at: string; rejectionReason?: string | null }[];
  orderCount: number;
  stream: { status: string; lastTickAt: number | null; error: string };
}

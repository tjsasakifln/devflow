export type GateCategory = "pre-code" | "verification" | "completion" | "post-merge";

export interface GuardCheck {
  checkId: string;
  description: string;
  passed: boolean;
  reason: string;
  blocking: boolean;
  gateNumber: number;
  remediation: string;
  category?: GateCategory;
  approvalRequired?: boolean;
  approvedBy?: string;
}

export interface GuardResult {
  canProceed: boolean;
  checks: GuardCheck[];
  refusalMessage: string | null;
  requiredActions: string[];
  blockingFailed: number;
  advisoryFailed: number;
}

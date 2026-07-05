export interface GuardCheck {
  checkId: string;
  description: string;
  passed: boolean;
  reason: string;
}

export interface GuardResult {
  canProceed: boolean;
  checks: GuardCheck[];
  refusalMessage: string | null;
  requiredActions: string[];
}

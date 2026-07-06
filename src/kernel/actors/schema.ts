/**
 * Actor Registry Schema
 *
 * Actors are humans or AI agents authorized to perform specific roles.
 * The registry is stored in .devflow/actors.json and managed by devflow init.
 *
 * In release mode, unknown actors can never approve.
 */

// ── Types ──

export type ActorRole =
  | "implementer"
  | "reviewer"
  | "gatekeeper"
  | "maintainer"
  | "ai-agent";

export type AuthMethod = "cli-flag" | "env-var" | "git-user" | "gpg-key" | "machine-id" | "unknown";

export interface AuthorizedActor {
  /** Stable unique identifier for this actor. */
  id: string;
  /** Human-readable display name. */
  name: string;
  /** Roles this actor is authorized to perform. */
  roles: ActorRole[];
  /** Machine fingerprint hash for local identity verification. */
  machineFingerprint?: string;
  /** Git user.email hash for cross-machine identity linking. */
  gitEmailHash?: string;
  /** Public key for future signature verification. */
  publicKey?: string;
  /** When this actor was registered. */
  registeredAt: string;
}

export interface ApprovalPolicy {
  /** If true, actors must be in the registry to perform actions. */
  requireExplicitActor: boolean;
  /** If true, implementer and approver must be different actors. */
  requireDifferentActor: boolean;
  /** Maximum Levenshtein distance for name variation detection (0 = exact match only). */
  maxNameVariationDistance: number;
  /** Modes in which unknown actors are blocked. */
  unknownBlocksInMode: string[];
}

export interface ActorRegistry {
  /** Schema version. */
  version: string;
  /** Registered actors. */
  actors: AuthorizedActor[];
  /** Approval policy configuration. */
  policy: ApprovalPolicy;
}

// ── Defaults ──

export const DEFAULT_ACTOR_REGISTRY: ActorRegistry = {
  version: "1.0.0",
  actors: [],
  policy: {
    requireExplicitActor: false,
    requireDifferentActor: true,
    maxNameVariationDistance: 3,
    unknownBlocksInMode: ["strict", "release"],
  },
};

// ── Identity Helpers ──

/** Detect how an actor was identified. */
export function detectAuthMethod(actor: string | undefined): AuthMethod {
  if (actor) return "cli-flag";
  if (process.env.DEVFLOW_ACTOR) return "env-var";
  if (process.env.USER || process.env.USERNAME) return "git-user";
  return "unknown";
}

/** Simple Levenshtein distance for name variation detection. */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array.from({ length: n + 1 }, () => 0),
  );
  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i]![j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1]![j - 1]!
          : 1 + Math.min(dp[i - 1]![j]!, dp[i]![j - 1]!, dp[i - 1]![j - 1]!);
    }
  }
  return dp[m]![n]!;
}

/** Check if two actor names might be the same person with a variation. */
export function isSameActorVariant(
  a: string,
  b: string,
  maxDistance: number,
): boolean {
  const aLower = a.toLowerCase().trim();
  const bLower = b.toLowerCase().trim();
  if (aLower === bLower) return true;
  return levenshteinDistance(aLower, bLower) <= maxDistance;
}

# ADR-003: Multi-Agent Orchestration with Adversarial Verification

- **Status:** Accepted
- **Date:** 2026-06-15
- **Deciders:** Devflow Architecture Team

## Context

Single-agent code review is limited by the reviewer's perspective. A multi-agent approach can cover multiple dimensions (security, performance, correctness, architecture) simultaneously, with adversarial verification to reduce false positives.

## Decision

Implement multi-agent orchestration with three patterns:

1. **Parallel Spawner** (`src/kernel/orchestration/parallel-spawner.ts`) — Fan-out analysis to N agents across different dimensions
2. **Adversarial Verifier** (`src/kernel/orchestration/adversarial-verify.ts`) — N skeptics vote on each finding; majority-vote decides
3. **Completeness Critic** (`src/kernel/orchestration/completeness-critic.ts`) — Gap detection: what modality, claim, or source wasn't covered?

These patterns are in-process (not spawned subprocesses) for the current implementation. True multi-agent spawning is deferred.

## Consequences

### Positive
- Multiple perspectives reduce blind spots
- Adversarial verification reduces false positives
- Graceful degradation when partial analysis fails

### Negative
- Increased analysis time (N agents vs 1)
- Experimental flag required for adversarial mode (see Story 2.8)

## Alternatives Considered

| Alternative | Reason Rejected |
|-------------|-----------------|
| Single deterministic review only | Insufficient coverage for complex changes |
| Full LLM-based review pipeline | Cost and latency concerns; hybrid approach preferred |

## References

- Commits `e4c277b`, `3ace834`: Orchestration implementation
- Epic 3: Multi-agent patterns

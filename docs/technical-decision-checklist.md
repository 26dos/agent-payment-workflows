# Technical Decision Checklist

This checklist captures the main engineering decisions required before turning the agent payment workflow sandbox into a production-grade system.

## Infrastructure Choices

| Decision | Options | Notes |
| --- | --- | --- |
| Settlement environment | EVM L2, private testnet, appchain, off-chain ledger first | Pick based on latency, cost, and auditability. |
| Indexing | SQL event table, The Graph, custom indexer | The demo already benefits from a simple SQL event trail. |
| Wallet model | EOA, smart account, MPC, HSM | Agent keys should be scoped and recoverable. |
| API authentication | Wallet signature, service token, OAuth bridge | Agent clients need a non-browser auth path. |

## Identity And Authorization

| Decision | Question |
| --- | --- |
| Root identity | Is the human operator represented by wallet address, DID document, or account record? |
| Agent identity | Are agent IDs derived from the root identity or created independently? |
| Mandate format | Should spending mandates use EIP-712 signatures, database policies, or both? |
| Expiration | Are mandates time-limited, task-limited, or balance-limited? |
| Revocation | How quickly can a human revoke an agent's authority? |

## Task Lifecycle

Required states:

```text
created -> accepted -> funded -> in_progress -> completed -> released
created -> cancelled
accepted -> expired
in_progress -> disputed -> resolved -> released/refunded
```

Implementation questions:

- Which actor may trigger each transition?
- Which transitions require a signed proof or backend validation?
- Which transitions update reputation?
- Which transitions emit settlement events?
- How are retries and duplicate events handled?

## Pricing Policy

The demo pricing model is intentionally simple:

```text
final_price = base_fee * k_reputation * k_complexity * k_supply_demand
```

Before production, define:

- the bounds for each multiplier;
- whether the model is deterministic or service-controlled;
- how price quotes expire;
- whether quote inputs are persisted for audit;
- how anomalous quotes are rejected.

## Reliability Metadata

Track enough metadata to answer:

- Did the agent finish accepted work?
- How often does the agent enter dispute?
- Does the agent respond within expected time windows?
- Does task complexity correlate with failed outcomes?
- Should reliability decay after inactivity?

## Security Review

Minimum review areas:

- mandate replay protection;
- key compromise and revocation;
- idempotency for task and settlement events;
- dispute-resolution permissions;
- authorization checks on every state transition;
- audit log immutability;
- rate limits for automated clients.

## Demo Readiness Criteria

Before making the repo public again, the first five minutes should show:

1. a static demo route that works without wallet setup;
2. screenshots in the README;
3. an API walkthrough for agent task lifecycle;
4. clear diagrams for state transitions and data flow;
5. no chain-specific language above the fold.

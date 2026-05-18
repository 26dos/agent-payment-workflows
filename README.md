# agent-payment-workflows

Full-stack workflow sandbox for AI agents that need to request work, accept
tasks, reserve payment, update status, and resolve outcomes.

This repo is framed as agent transaction infrastructure rather than a payment
protocol. It models the lifecycle around autonomous work: identity, task
creation, delegated spending limits, escrow as state management, reputation as
agent reliability metadata, and pricing as a decision policy.

The implementation includes a Go API service, PostgreSQL persistence, a
Next.js operator UI, and Solidity contracts for the settlement layer.

See [docs/demo-walkthrough.md](docs/demo-walkthrough.md) for a static UI demo,
screenshots, lifecycle example, and API walkthrough.

## What It Demonstrates

- **Agent task lifecycle**: create, accept, complete, dispute, resolve, cancel,
  and expire task records.
- **Escrow as workflow state**: reserve funds while work is pending, then
  release or reroute them based on the final state.
- **Delegated spending controls**: mandates define daily and per-task limits
  for autonomous agents.
- **Reputation metadata**: reliability scores influence pricing and risk
  handling.
- **Pricing policy**: dynamic quotes combine base fee, reputation, complexity,
  and supply/demand factors.
- **Full-stack integration**: contracts, backend APIs, database migrations, and
  frontend views work together as one prototype.

## System Shape

```
operator / agent client
        |
        v
Next.js workflow UI
        |
        v
Go API service
        |
        +--> PostgreSQL workflow state
        +--> pricing and reputation modules
        +--> mandate and identity records
        |
        v
settlement contracts
        |
        v
task escrow, release, dispute, and resolution events
```

## Core Workflow

```
Created -> Accepted -> Funded -> In Progress -> Completed -> Released
    |          |            |          |             |
    v          v            v          v             v
Cancelled   Expired      Disputed -> Resolved -> Refunded / Released
```

The goal is to make agent-operated transactions inspectable. A reviewer should
be able to answer:

- who authorized the agent to spend?
- what limits applied to the task?
- what price policy produced the quote?
- what state transitions happened?
- which actor resolved a dispute?
- how did reputation change after the outcome?

## Repository Layout

```
agent-payment-workflows/
  docs/
    demo-walkthrough.md
    assets/screenshots/

  frontend/
    app/demo/          static workflow demo for portfolio screenshots

  contracts/          settlement and workflow contracts
    src/
      DIDRegistry.sol
      ReputationScore.sol
      DynamicPricing.sol
      InsurancePool.sol
      ClawPayEscrow.sol
    test/
    script/

  backend/            Go API service
    cmd/server/
    internal/
    migrations/

  frontend/           Next.js workflow console
```

## API Surface

### Authentication

- `GET /api/v1/auth/nonce`
- `POST /api/v1/auth/login`

### User And Identity

- `GET /api/v1/user/profile`
- `PUT /api/v1/user/did`

### Agents

- `POST /api/v1/agents`
- `GET /api/v1/agents`
- `PUT /api/v1/agents/:id/mandate`

### Tasks

- `POST /api/v1/tasks`
- `GET /api/v1/tasks`
- `PUT /api/v1/tasks/:id/complete`
- `PUT /api/v1/tasks/:id/dispute`

### Pricing

- `POST /api/v1/pricing/calculate`

## Pricing Policy

```text
total_cost = base_fee * reputation_factor * complexity_factor * demand_factor
```

| Factor | Example policy |
| --- | --- |
| Reputation | lower cost for high-reliability agents, higher cost for low-reliability agents |
| Complexity | larger multiplier for harder tasks |
| Supply/demand | lower when idle, higher at peak demand |

## Reputation Model

```text
final_score = human_score * 0.7 + agent_score * 0.3
```

- **Human score**: identity, compliance, and account-level history.
- **Agent score**: task success rate, response efficiency, and accuracy.

The scoring model is intentionally simple so the system can show how reliability
metadata affects workflow decisions without hiding the policy in a black box.

## Settlement Layer

The current settlement prototype uses Solidity contracts deployed to a BSC
testnet. That is an implementation detail, not the main product framing. The
important interface is the workflow contract boundary:

| Contract | Role |
| --- | --- |
| `DIDRegistry` | identity records for humans and agents |
| `ReputationScore` | reliability metadata |
| `DynamicPricing` | quote calculation policy |
| `InsurancePool` | reserve pool for workflow risk |
| `ClawPayEscrow` | task escrow and state transitions |

## Getting Started

### Contracts

```bash
cd contracts
forge install OpenZeppelin/openzeppelin-contracts
forge build
forge test
```

### Backend

```bash
cd backend
go mod download
createdb clawpay
psql -d clawpay -f migrations/001_init.sql
cp .env.example .env
go run cmd/server/main.go
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

## Development Checks

```bash
cd contracts && forge test -vvv
cd backend && go test ./...
cd frontend && npm test
```

## Why Keep This Private For Now

This is a useful full-stack agent workflow prototype, but it should stay private
until the UI screenshots, API examples, and task lifecycle docs make the agent
workflow story stronger than the settlement-chain implementation details.

## License

MIT. See [LICENSE](LICENSE).

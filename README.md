# ClawPay - Agentic Settlement Protocol

An on-chain payment settlement protocol designed for AI agents, built on BSC (Binance Smart Chain).

## Overview

ClawPay enables AI agents to transact autonomously with built-in escrow, reputation scoring, and dynamic pricing mechanisms. It serves as the "PayPal for machines" - providing trust and settlement infrastructure for the Machine Economy.

## Features

- **Decentralized Identity (DID)**: Human Root DIDs and Agent Sub-DIDs for identity management
- **Escrow System**: Trustless fund locking with dispute resolution
- **Dynamic Pricing**: Real-time price adjustments based on reputation, complexity, and demand
- **Reputation Scoring**: Dual-layer scoring (Human 70% + Agent 30%)
- **Insurance Pool**: Risk mitigation through premium collection
- **Mandate System**: Delegated spending controls for agents

## Project Structure

```
ClawPay/
├── contracts/          # Solidity smart contracts (Foundry)
│   ├── src/
│   │   ├── USD1Mock.sol
│   │   ├── DIDRegistry.sol
│   │   ├── ReputationScore.sol
│   │   ├── DynamicPricing.sol
│   │   ├── InsurancePool.sol
│   │   └── ClawPayEscrow.sol
│   ├── test/
│   └── script/
│
├── backend/            # Go API server
│   ├── cmd/server/
│   ├── internal/
│   └── migrations/
│
└── frontend/           # Next.js web application
    ├── app/
    ├── components/
    └── lib/
```

## Getting Started

### Prerequisites

- Node.js 18+
- Go 1.21+
- Foundry (for smart contracts)
- PostgreSQL 14+
- MetaMask or compatible wallet

### 1. Smart Contracts

```bash
cd contracts

# Install dependencies
forge install OpenZeppelin/openzeppelin-contracts

# Build contracts
forge build

# Run tests
forge test

# Deploy to BSC Testnet
cp .env.example .env
# Edit .env with your private key and RPC URL
forge script script/Deploy.s.sol --rpc-url $BSC_TESTNET_RPC --broadcast
```

### 2. Backend

```bash
cd backend

# Install dependencies
go mod download

# Set up database
createdb clawpay
psql -d clawpay -f migrations/001_init.sql

# Configure environment
cp .env.example .env
# Edit .env with your configuration

# Run server
go run cmd/server/main.go
```

### 3. Frontend

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with contract addresses and API URL

# Run development server
npm run dev
```

## Contract Addresses (BSC Testnet)

Deployed on 2026-02-10:

| Contract | Address |
|----------|---------|
| USD1Mock | `0x8b4C6b67976D9863FD56f6fFF140e501d838a758` |
| DIDRegistry | `0x0071cA34341557Db09Eb976db947d9Cb1F06Ada8` |
| ReputationScore | `0xBB78F645C565bCbB3d4a30A7398b61f7968e60b2` |
| DynamicPricing | `0x28dBC4F5d362A3778F5492f1623C1777e8b24529` |
| InsurancePool | `0x8E0Ea2482196e4CcFDdB601E007BCa9AFe71Df75` |
| ClawPayEscrow | `0x2987782FD00274b6d5Ce235a4cf38c8e36fb0f52` |

View on BscScan: https://testnet.bscscan.com/address/0x2987782FD00274b6d5Ce235a4cf38c8e36fb0f52

## API Endpoints

### Authentication
- `GET /api/v1/auth/nonce` - Get signing nonce
- `POST /api/v1/auth/login` - Login with wallet signature

### User
- `GET /api/v1/user/profile` - Get user profile
- `PUT /api/v1/user/did` - Update user DID

### Agents
- `POST /api/v1/agents` - Create agent
- `GET /api/v1/agents` - List agents
- `PUT /api/v1/agents/:id/mandate` - Update mandate

### Tasks
- `POST /api/v1/tasks` - Create task
- `GET /api/v1/tasks` - List tasks
- `PUT /api/v1/tasks/:id/complete` - Complete task
- `PUT /api/v1/tasks/:id/dispute` - Raise dispute

### Pricing
- `POST /api/v1/pricing/calculate` - Calculate dynamic price

## Pricing Formula

```
Total_Cost = Base_Fee × K_Reputation × K_Complexity × K_Supply/Demand
```

| Coefficient | Conditions |
|-------------|------------|
| K_Reputation | 0.8x (>90), 1.0x (60-90), 1.2x (40-60), 1.5x (<40) |
| K_Complexity | 1.0x (L1), 1.5x (L2), 2.5x (L3) |
| K_Supply/Demand | 0.9x (idle) to 2.0x (peak) |

## Reputation Scoring

```
Final_Score = (Human_Score × 0.7) + (Agent_Score × 0.3)
```

- **Human Score**: Financial credibility, compliance history, identity verification
- **Agent Score**: Task success rate, response efficiency, accuracy

## Task Lifecycle

```
Created → Accepted → Completed
    ↓         ↓
Cancelled   Disputed → Resolved
    ↓
Expired
```

## Security Considerations

- All contract interactions require valid DID ownership verification
- Mandates provide spending controls with daily/single limits
- Escrow funds are locked until task completion or dispute resolution
- Insurance pool covers losses from low-reputation agent defaults

## Development

### Running Tests

```bash
# Contracts
cd contracts && forge test -vvv

# Backend
cd backend && go test ./...

# Frontend
cd frontend && npm test
```

### Code Style

- Solidity: Follow Foundry formatting (forge fmt)
- Go: Standard Go formatting (go fmt)
- TypeScript: ESLint + Prettier

## License

MIT License - see LICENSE file

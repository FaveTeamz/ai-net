# ABI Documentation — AI-Net Soroban Contracts

This directory contains automatically-generated ABI reference documentation for
every Soroban smart contract in the AI-Net workspace. Each contract has its own
file describing its public functions, parameter types, return types, and events.

## Contracts

| Contract | Description | ABI Doc |
|---|---|---|
| **agent-registry** | On-chain registry for AI agents with batch registration, SLA, analytics, and multisig governance | [agent-registry.md](./agent-registry.md) |
| **agent-bidding** | Sealed-bid auction contract for task allocation between agents | [agent-bidding.md](./agent-bidding.md) |
| **error-registry** | On-chain error reporting store with TTL expiration | [error-registry.md](./error-registry.md) |
| **task-store** | Task lifecycle state machine with oracle price stamping | [task-store.md](./task-store.md) |
| **agent-governance** | On-chain weighted voting governance for protocol parameters | [agent-governance.md](./agent-governance.md) |

## How Docs Are Generated

ABI documentation is extracted directly from Rust contract source code under
`smart-contracts/contracts/*/src/lib.rs`. A generation script reads `pub fn`
signatures from `#[contractimpl]` blocks, inline doc-comments, and event type
definitions to produce these markdown files.

CI enforces that these files stay in sync with the contract sources. If you
change a public function signature or add a new event, re-run the generator:

```bash
cd smart-contracts
npm run docs:abi        # regenerates all files in docs/abi/
npm run docs:abi:check  # exits non-zero if docs are out of sync (used in CI)
```

> **Note**: The CI check (`npm run docs:abi:check`) compares checksums of the
> generated output against what is committed. Any drift between contract source
> and committed docs causes the build to fail.

## Common Types

All Soroban contracts in this workspace share the following base types:

| Type | Soroban SDK Type | Description |
|---|---|---|
| `Address` | `soroban_sdk::Address` | Stellar account or contract address |
| `Symbol` | `soroban_sdk::Symbol` | Short on-chain string (≤ 32 chars) |
| `String` | `soroban_sdk::String` | Variable-length on-chain string |
| `BytesN<32>` | `soroban_sdk::BytesN<32>` | 32-byte fixed-length byte array |
| `Bytes` | `soroban_sdk::Bytes` | Variable-length byte array |
| `Vec<T>` | `soroban_sdk::Vec<T>` | Ordered list of values |
| `Map<K,V>` | `soroban_sdk::Map<K,V>` | Key-value mapping |
| `i128` | Rust `i128` | Signed 128-bit integer (used for stroops) |
| `u32` | Rust `u32` | Unsigned 32-bit integer |
| `u64` | Rust `u64` | Unsigned 64-bit integer |

## Stroops

All XLM amounts in these contracts are expressed in **stroops** (1 XLM = 10,000,000 stroops).

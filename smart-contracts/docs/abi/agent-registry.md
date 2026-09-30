# ABI Reference — `agent-registry`

> **Source**: `smart-contracts/contracts/agent_registry/src/lib.rs`  
> **Crate name**: `agent-registry`  
> **Contract type**: `AgentRegistryContract`

The Agent Registry is the central on-chain directory for AI agents. It handles
registration, capability indexing, reputation tracking, SLA monitoring, error
reporting, analytics, multisig governance, and cross-chain identity bridging.

---

## Constants

| Constant | Value | Description |
|---|---|---|
| `DEFAULT_TIMELOCK_DELAY` | `86_400` (24 h) | Default governance timelock delay in seconds |
| `DEFAULT_PROPOSAL_EXPIRY` | `604_800` (7 d) | Default proposal validity period in seconds |
| `DEFAULT_MIN_BOND_STROOPS` | `100_000_000` (10 XLM) | Minimum registration bond in stroops |
| `BOND_COOLDOWN_LEDGERS` | `17_280` (~24 h) | Ledgers before deregistered bond is returned |
| `DEFAULT_ERROR_TTL` | `120_960` (~7 d) | Default error entry retention in ledger sequences |
| `DEFAULT_PAGE_SIZE` | `20` | Default cursor pagination page size |
| `MAX_PAGE_SIZE` | `50` | Maximum cursor pagination page size |
| `SLA_PENALTY_PERCENT` | `10` | SLA violation bond slash percentage |
| `SLA_BONUS_REPUTATION_BOOST` | `5` | Reputation points awarded on SLA bonus |

---

## Types

### `AgentRecord`

Stored agent entry.

| Field | Type | Description |
|---|---|---|
| `id` | `Symbol` | Unique agent identifier (≤ 32 chars) |
| `capability` | `Symbol` | Agent capability tag (e.g. `coding`, `research`) |
| `price_stroops` | `i128` | Service price in stroops (must be > 0) |
| `endpoint` | `String` | HTTP endpoint URL for the agent |
| `owner` | `Address` | Stellar account that owns this agent |
| `metadata` | `Map<Symbol, Val>` | Up to 5 arbitrary key-value metadata entries |
| `bond_amount` | `i128` | XLM bond locked at registration time (≥ `min_bond`) |

### `AgentPage`

Paginated response for `get_agents`.

| Field | Type | Description |
|---|---|---|
| `agents` | `Vec<AgentRecord>` | Agents on the current page |
| `next_cursor` | `Option<u32>` | Cursor to fetch the next page, or `None` if last page |
| `total_count` | `u32` | Total active agents in the registry |

### `AgentHealth`

Aggregate health view for a single agent.

| Field | Type | Description |
|---|---|---|
| `agent_id` | `Symbol` | Agent identifier |
| `exists` | `bool` | Whether the agent is currently registered |
| `frozen` | `bool` | Whether the agent is frozen (locked out of operations) |
| `error_count` | `u32` | Open error count from the error-resolver (0 if not configured) |

### `ErrorEntry`

On-chain error record (used in `agent-registry`'s internal error log).

| Field | Type | Description |
|---|---|---|
| `id` | `BytesN<32>` | Unique error identifier |
| `reporter` | `Address` | Address that reported the error |
| `message` | `String` | Human-readable error description |
| `resolved` | `bool` | Whether the error has been resolved |
| `resolution` | `Resolution` | Resolution type (`Fixed`, `Ignored`, `Escalated`) |
| `created_at` | `u64` | Ledger sequence at which the entry was created |
| `expires_at` | `u64` | Ledger sequence at/after which entry is eligible for cleanup |

### `Resolution` (enum)

| Variant | Value | Description |
|---|---|---|
| `Fixed` | `0` | Error was fixed by the agent |
| `Ignored` | `1` | Error was acknowledged but not actioned |
| `Escalated` | `2` | Error was escalated to governance |

### `GasConfig`

Empirical gas budget parameters (overridable by admin).

| Field | Type | Description |
|---|---|---|
| `tx_overhead` | `u64` | Fixed overhead per transaction (CU) |
| `register_agent` | `u64` | Cost for a single `register_agent` |
| `register_agent_marginal` | `u64` | Marginal cost per extra agent in batch |
| `resolve_error` | `u64` | Cost for a single error resolution |
| `resolve_error_marginal` | `u64` | Marginal cost per extra resolution in batch |
| `slash_bond` | `u64` | Cost for `slash_bond` |
| `deregister_with_bond` | `u64` | Cost for `deregister_agent` with bond return |
| `cleanup_error` | `u64` | Cost for checking/removing a single expired error |
| `cleanup_error_marginal` | `u64` | Marginal cost per extra error in cleanup batch |

### `StorageConfig`

Configurable storage limits per contract instance.

| Field | Type | Description |
|---|---|---|
| `max_agents` | `u32` | Global agent limit (`0` = unlimited) |
| `max_per_capability` | `u32` | Per-capability agent limit (`0` = unlimited) |

---

## Public Functions

### Initialization & Admin

#### `initialize(env, admin) -> Result<(), Error>`

Initializes the contract and sets the admin address. Can only be called once.

| Parameter | Type | Description |
|---|---|---|
| `admin` | `Address` | Initial administrator address |

**Errors**: `AlreadyInitialized`

---

#### `set_admin(env, new_admin) -> Result<(), Error>`

Replaces the admin address. Requires current admin authorization.

| Parameter | Type | Description |
|---|---|---|
| `new_admin` | `Address` | New administrator address |

**Auth**: Admin  
**Errors**: `Unauthorized`, `NotInitialized`

---

#### `pause(env) -> Result<(), Error>`

Pauses the contract, blocking `register_agent`, `deregister_agent`, and `update_pricing`.

**Auth**: Admin  
**Errors**: `Unauthorized`

---

#### `unpause(env) -> Result<(), Error>`

Resumes normal operation after a pause.

**Auth**: Admin  
**Errors**: `Unauthorized`

---

#### `is_paused(env) -> bool`

Returns `true` if the contract is currently paused.

---

### Multisig Governance

#### `set_multisig_config(env, config) -> Result<(), Error>`

Configures multisig thresholds and signers for admin operations.

| Parameter | Type | Description |
|---|---|---|
| `config` | `MultisigConfig` | Multisig configuration (threshold, signers, timelock) |

**Auth**: Admin

---

#### `get_multisig_config(env) -> Option<MultisigConfig>`

Returns the current multisig configuration, or `None` if not set.

---

#### `propose_operation(env, proposer, operation_type, payload, ...) -> Result<u64, Error>`

Creates a new governance proposal. Returns the proposal ID.

**Auth**: Proposer (must be an authorized signer)

---

#### `approve_operation(env, approver, proposal_id) -> Result<(), Error>`

Casts an approval vote on an existing proposal.

| Parameter | Type | Description |
|---|---|---|
| `approver` | `Address` | Authorized signer casting approval |
| `proposal_id` | `u64` | Target proposal identifier |

**Auth**: Approver

---

#### `execute_operation(env, executor, proposal_id) -> Result<(), Error>`

Executes a proposal that has reached threshold and passed the timelock.

| Parameter | Type | Description |
|---|---|---|
| `executor` | `Address` | Address executing the proposal |
| `proposal_id` | `u64` | Proposal to execute |

**Auth**: Executor

---

#### `cancel_operation(env, canceller, proposal_id) -> Result<(), Error>`

Cancels an in-flight proposal before execution.

**Auth**: Admin or original proposer

---

#### `get_proposal(env, proposal_id) -> Result<Proposal, Error>`

Returns the full proposal record.

---

### Agent Registration

#### `register_agent(env, agent) -> Result<(), Error>`

Registers a single agent. The caller must transfer a bond ≥ `min_bond`.

| Parameter | Type | Description |
|---|---|---|
| `agent` | `AgentRecord` | Agent record to register |

**Auth**: `agent.owner`  
**Errors**: `AlreadyExists`, `InsufficientBond`, `ZeroPrice`, `NegativePrice`, `StorageLimitReached`, `Paused`

---

#### `register_agents(env, agents) -> Vec<BatchResult>`

Batch-registers multiple agents atomically. Entire batch is rejected if any item fails validation.

| Parameter | Type | Description |
|---|---|---|
| `agents` | `Vec<AgentRecord>` | List of agent records to register |

**Returns**: `Vec<BatchResult>` — per-item success/error code  
**Auth**: Each `agent.owner` (unique owners authorized once each)

---

#### `deregister_agent(env, agent_id) -> Result<(), Error>`

Deregisters the agent and starts the bond cooldown period (~24 h). Bond is returned after cooldown.

| Parameter | Type | Description |
|---|---|---|
| `agent_id` | `Symbol` | Agent to deregister |

**Auth**: Agent owner  
**Errors**: `NotFound`, `Unauthorized`, `Paused`

---

#### `freeze_agent(env, agent_id) -> Result<(), Error>`

Freezes an agent, blocking further registrations and pricing updates.

**Auth**: Admin  
**Errors**: `NotFound`, `Unauthorized`

---

#### `unfreeze_agent(env, agent_id) -> Result<(), Error>`

Unfreezes a previously frozen agent.

**Auth**: Admin

---

#### `is_agent_frozen(env, agent_id) -> bool`

Returns `true` if the agent is currently frozen.

---

### Agent Lookup & Discovery

#### `lookup_agents(env, capability) -> Vec<AgentRecord>`

Returns all agents registered for the given capability.

| Parameter | Type | Description |
|---|---|---|
| `capability` | `Symbol` | Capability tag to look up |

---

#### `get_agents(env, cursor, limit) -> AgentPage`

Cursor-paginated listing of all registered agents.

| Parameter | Type | Description |
|---|---|---|
| `cursor` | `Option<u32>` | Opaque pagination cursor (use `next_cursor` from previous response) |
| `limit` | `Option<u32>` | Page size, clamped to `[1, MAX_PAGE_SIZE]` |

**Returns**: `AgentPage` with `agents`, `next_cursor`, and `total_count`

---

#### `discover_agents(env, query) -> Vec<DiscoveryResult>`

Filtered, ranked agent discovery with multi-criteria filtering. Results are cached.

| Parameter | Type | Description |
|---|---|---|
| `query` | `DiscoveryQuery` | Discovery criteria (capability, price range, min reputation, etc.) |

**Returns**: `Vec<DiscoveryResult>` — ranked matching agents (frozen agents excluded)

---

#### `get_discovery_stats(env) -> DiscoveryStats`

Returns aggregate statistics about past discovery queries.

---

#### `get_agent_health(env, agent_id) -> AgentHealth`

Returns health status including frozen state and open error count for an agent.

---

### Pricing & Bonds

#### `update_pricing(env, agent_id, new_price) -> Result<(), Error>`

Updates the service price for a registered agent.

| Parameter | Type | Description |
|---|---|---|
| `agent_id` | `Symbol` | Agent to update |
| `new_price` | `i128` | New price in stroops (must be > 0) |

**Auth**: Agent owner  
**Errors**: `NotFound`, `Unauthorized`, `ZeroPrice`, `NegativePrice`, `Paused`

---

#### `set_min_bond(env, amount_stroops) -> Result<(), Error>`

Configures the minimum bond amount required for agent registration.

| Parameter | Type | Description |
|---|---|---|
| `amount_stroops` | `i128` | Minimum bond in stroops |

**Auth**: Admin

---

#### `get_min_bond(env) -> i128`

Returns the current minimum bond requirement in stroops.

---

#### `slash_bond(env, agent_id, penalty_stroops) -> Result<(), Error>`

Reduces an agent's locked bond as a penalty. Bond floors at 0 and cannot go negative.

| Parameter | Type | Description |
|---|---|---|
| `agent_id` | `Symbol` | Agent to slash |
| `penalty_stroops` | `i128` | Amount to deduct from the bond in stroops |

**Auth**: Admin  
**Errors**: `NotFound`, `Unauthorized`

---

### Error Reporting

#### `report_error(env, agent_id, error_id, message) -> Result<(), Error>`

Records an error against an agent. The entry is stored with a default TTL.

| Parameter | Type | Description |
|---|---|---|
| `agent_id` | `Symbol` | Agent the error is reported against |
| `error_id` | `BytesN<32>` | Unique error identifier (caller-supplied) |
| `message` | `String` | Human-readable error description |

**Errors**: `NotFound` (agent not registered)

---

#### `resolve_errors(env, error_ids, resolution) -> Result<u32, Error>`

Batch-resolves a list of error entries atomically.

| Parameter | Type | Description |
|---|---|---|
| `error_ids` | `Vec<BytesN<32>>` | IDs of errors to resolve |
| `resolution` | `Resolution` | How the errors were resolved |

**Returns**: Number of errors resolved  
**Auth**: Admin  
**Errors**: `Unauthorized`, `NotFound` (if any ID is missing — atomic rejection)

---

#### `cleanup_expired_errors(env, error_ids) -> u32`

Permissionless cleanup that removes expired error entries from storage.

| Parameter | Type | Description |
|---|---|---|
| `error_ids` | `Vec<BytesN<32>>` | Error IDs to check and remove if expired |

**Returns**: Count of entries actually removed

---

#### `get_error(env, error_id) -> Option<ErrorEntry>`

Returns a single error entry by ID, or `None` if expired or missing.

---

#### `set_error_ttl(env, ttl_ledgers) -> Result<(), Error>`

Configures the default TTL (in ledger sequences) applied to new error entries.

**Auth**: Admin

---

#### `get_error_ttl(env) -> u64`

Returns the current error TTL in ledger sequences.

---

### Gas Estimation

#### `estimate_gas(env, operation, count) -> u64`

Returns the estimated compute unit cost for a given operation and batch count.

| Parameter | Type | Description |
|---|---|---|
| `operation` | `String` | Operation name: `"register"`, `"resolve"`, `"cleanup"`, `"slash_bond"`, `"deregister_with_bond"` |
| `count` | `u32` | Batch size (0 returns 0) |

---

#### `set_gas_config(env, config) -> Result<(), Error>`

Replaces the empirical gas configuration used by `estimate_gas`.

**Auth**: Admin

---

#### `get_gas_config(env) -> GasConfig`

Returns the current gas configuration.

---

### Analytics & Leaderboard

#### `record_task_completion(env, agent_id, success, latency_ms) -> Result<(), Error>`

Records a task completion (success or failure) for analytics tracking.

| Parameter | Type | Description |
|---|---|---|
| `agent_id` | `Symbol` | Agent that completed the task |
| `success` | `bool` | Whether the task succeeded |
| `latency_ms` | `u64` | Task latency in milliseconds |

**Errors**: `NotFound`

---

#### `get_analytics(env, agent_id) -> AgentAnalytics`

Returns the full analytics record for an agent (task counts, success rate, avg latency).

---

#### `get_leaderboard(env, metric, limit) -> Vec<LeaderboardEntry>`

Returns the top-N agents ranked by a specified metric.

| Parameter | Type | Description |
|---|---|---|
| `metric` | `Symbol` | Ranking metric: `"reputation"`, `"tasks"`, `"success_rate"` |
| `limit` | `u32` | Number of entries to return |

---

### SLA Management

#### `set_sla(env, agent_id, ...) -> Result<(), Error>`

Configures SLA parameters for an agent.

| Parameter | Type | Description |
|---|---|---|
| `agent_id` | `Symbol` | Target agent |
| `min_uptime_pct` | `u32` | Minimum required uptime percentage (0–100) |
| `max_latency_ms` | `u64` | Maximum allowed task latency in milliseconds |
| `min_quality_score` | `u32` | Minimum quality score (0–100) |

**Auth**: Admin  
**Errors**: `NotFound`, `InvalidParams`, `DuplicateSLA`

---

#### `check_sla_compliance(env, agent_id) -> Result<SlaResult, Error>`

Checks whether an agent currently meets its SLA targets. Violations trigger a bond slash.

| Parameter | Type | Description |
|---|---|---|
| `agent_id` | `Symbol` | Agent to evaluate |

**Errors**: `NotFound`, `SlaNotConfigured`

---

#### `get_sla_status(env, agent_id) -> Option<(AgentMetrics, u32)>`

Returns the current metrics and violation count for an agent.

---

### Storage Configuration

#### `set_storage_config(env, config) -> Result<(), Error>`

Sets global and per-capability agent storage limits.

**Auth**: Admin

---

#### `get_storage_config(env) -> StorageConfig`

Returns the current storage limits configuration.

---

#### `total_agents(env) -> u32`

Returns the total number of currently registered agents.

---

### Cross-Chain Identity Bridging

#### `bridge_identity(env, agent_id, target_chain, proof) -> Result<(), Error>`

Registers a cross-chain identity proof for an agent.

| Parameter | Type | Description |
|---|---|---|
| `agent_id` | `Symbol` | Source agent identifier |
| `target_chain` | `TargetChain` | Target chain identifier |
| `proof` | `BridgeProof` | Cryptographic proof of identity on target chain |

**Auth**: Agent owner

---

#### `verify_bridge_proof(env, proof) -> Result<(), Error>`

Verifies a bridge proof against stored chain-specific public keys.

---

#### `get_bridge_proof(env, agent_id, target_chain) -> Option<BridgeProof>`

Returns the stored bridge proof for an agent/chain pair.

---

#### `revoke_bridge_proof(env, agent_id, target_chain) -> Result<(), Error>`

Revokes a previously registered bridge proof.

**Auth**: Agent owner or Admin

---

### Audit Trail

#### `get_audit_log(env, start, limit) -> Vec<AuditEntry>`

Returns paginated audit log entries.

| Parameter | Type | Description |
|---|---|---|
| `start` | `u64` | Start sequence number (inclusive) |
| `limit` | `u64` | Maximum entries to return |

---

#### `get_audit_total(env) -> u64`

Returns the total number of recorded audit entries.

---

#### `set_audit_config(env, config) -> Result<(), Error>`

Configures audit thresholds and anomaly detection parameters.

**Auth**: Admin

---

#### `error_mapper(env, raw_code) -> Option<CommonExitCode>`

Maps a contract-specific error code to a common cross-contract exit code.

---

## Events

Events are emitted to the Soroban event log. Each event has a `topic` array and a `data` payload.

### `RegistryInitializedEvent`

Emitted when `initialize` is called.

| Field | Type | Description |
|---|---|---|
| `admin` | `Address` | Initial admin address |
| `timestamp` | `u64` | Ledger timestamp |

---

### `AdminChangedEvent`

Emitted when `set_admin` is called.

| Field | Type | Description |
|---|---|---|
| `old_admin` | `Address` | Previous admin |
| `new_admin` | `Address` | New admin |

---

### `AgentRegisteredEvent`

Emitted when an agent is successfully registered (single or batch).

| Field | Type | Description |
|---|---|---|
| `agent_id` | `Symbol` | Registered agent ID |
| `capability` | `Symbol` | Agent capability |
| `owner` | `Address` | Agent owner |
| `price_stroops` | `i128` | Registered price |
| `bond_amount` | `i128` | Bond locked at registration |

---

### `AgentDeregisteredEvent`

Emitted when an agent is deregistered.

| Field | Type | Description |
|---|---|---|
| `agent_id` | `Symbol` | Deregistered agent ID |
| `owner` | `Address` | Agent owner |

---

### `ErrorReportedEvent`

Emitted when an error is reported against an agent.

| Field | Type | Description |
|---|---|---|
| `error_id` | `BytesN<32>` | Unique error identifier |
| `agent_id` | `Symbol` | Agent the error was reported against |
| `reporter` | `Address` | Address that reported the error |
| `expires_at` | `u64` | Ledger sequence when the entry expires |

---

### `ErrorResolvedEvent`

Emitted for each error resolved in a batch.

| Field | Type | Description |
|---|---|---|
| `error_id` | `BytesN<32>` | Resolved error ID |
| `resolution` | `Resolution` | How the error was resolved |

---

### `SlaSetEvent`

Emitted when SLA parameters are configured for an agent.

| Field | Type | Description |
|---|---|---|
| `agent_id` | `Symbol` | Target agent |
| `min_uptime_pct` | `u32` | Configured uptime threshold |
| `max_latency_ms` | `u64` | Configured latency threshold |
| `min_quality_score` | `u32` | Configured quality threshold |

---

### `SlaViolationDetectedEvent`

Emitted when an SLA check detects a violation.

| Field | Type | Description |
|---|---|---|
| `agent_id` | `Symbol` | Agent in violation |
| `violation_type` | `Symbol` | `"uptime"`, `"latency"`, or `"quality"` |
| `penalty_stroops` | `i128` | Bond amount slashed |

---

### `SlaBonusAwardedEvent`

Emitted when consistent SLA compliance earns a reputation bonus.

| Field | Type | Description |
|---|---|---|
| `agent_id` | `Symbol` | Agent receiving the bonus |
| `reputation_boost` | `u32` | Reputation points added |

---

### `LeaderboardUpdatedEvent`

Emitted after each `get_leaderboard` call that refreshes rankings.

| Field | Type | Description |
|---|---|---|
| `metric` | `Symbol` | Ranking metric used |
| `top_agent` | `Symbol` | Top-ranked agent ID |

---

### `AnalyticsRecordedEvent`

Emitted after `record_task_completion`.

| Field | Type | Description |
|---|---|---|
| `agent_id` | `Symbol` | Agent whose analytics were updated |
| `success` | `bool` | Whether the recorded task succeeded |
| `latency_ms` | `u64` | Recorded latency |

---

### `DiscoveryQueryEvent`

Emitted when `discover_agents` is called with cached results.

| Field | Type | Description |
|---|---|---|
| `capability` | `Symbol` | Requested capability |
| `result_count` | `u32` | Number of matching agents returned |

---

### `IdentityBridgedEvent`

Emitted when a cross-chain identity is bridged.

| Field | Type | Description |
|---|---|---|
| `agent_id` | `Symbol` | Agent whose identity was bridged |
| `target_chain` | `TargetChain` | Target chain |

---

### Upgrade Events

| Event | Description |
|---|---|
| `ContractUpgradedEvent` | Emitted after a successful WASM upgrade |
| `UpgradeInitiatedEvent` | Emitted when an upgrade is proposed |
| `ContractRolledBackEvent` | Emitted after emergency rollback |
| `PreUpgradeHookEvent` | Emitted before upgrade migration runs |
| `PostUpgradeHookEvent` | Emitted after upgrade migration completes |

---

## Error Codes

| Code | Name | Description |
|---|---|---|
| `1` | `NotFound` | Agent, error, or resource does not exist |
| `2` | `AlreadyExists` | Agent ID is already registered |
| `3` | `Unauthorized` | Caller lacks required authorization |
| `4` | `AlreadyInitialized` | `initialize` was called more than once |
| `5` | `NotInitialized` | Contract has not been initialized |
| `6` | `InvalidParams` | Parameter validation failed |
| `7` | `ZeroPrice` | Price must be greater than zero |
| `8` | `NegativePrice` | Price must be non-negative |
| `9` | `InsufficientBond` | Bond amount is below `min_bond` |
| `10` | `StorageLimitReached` | Global or per-capability agent cap exceeded |
| `11` | `Paused` | Contract is paused |
| `12` | `Frozen` | Agent is frozen |
| `13` | `CooldownActive` | Bond is still within cooldown period |
| `14` | `DuplicateSLA` | SLA already configured for this agent |
| `15` | `SlaNotConfigured` | `check_sla_compliance` called without SLA set |

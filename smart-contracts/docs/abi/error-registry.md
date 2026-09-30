# ABI Reference — `error-registry`

> **Source**: `smart-contracts/contracts/error-registry/src/lib.rs`  
> **Crate name**: `error-registry`  
> **Contract type**: `ErrorRegistryContract`

The Error Registry is an on-chain store for agent error reports with
application-level TTL expiration. Records are read-time filtered (expired
records are never returned), and a permissionless cleanup function reclaims
storage for expired entries.

---

## Constants

| Constant | Value | Description |
|---|---|---|
| `MAX_TTL_SECONDS` | `7_776_000` (90 days) | Maximum allowed TTL for a single record |
| `MAX_CLEANUP_BATCH` | `100` | Maximum records removed in a single cleanup call |
| `DEFAULT_CLEANUP_BATCH` | `50` | Default batch size when `0` is passed to `cleanup_expired_errors` |
| `CONTRACT_VERSION` | `"1.0.0"` | Deployed contract version |

---

## Types

### `ErrorRecord`

A single on-chain error report.

| Field | Type | Description |
|---|---|---|
| `error_code` | `u32` | Application-defined error code; used as secondary index key |
| `message` | `Symbol` | Short human-readable error description (≤ 32 chars) |
| `agent_id` | `Symbol` | Identifier of the agent that reported the error |
| `created_at` | `u64` | Ledger timestamp (seconds) at submission time |
| `expires_at` | `u64` | Ledger timestamp (seconds) after which the record is considered expired |

> **Expiry semantics**: `expires_at` is the last second the record is
> **active**. A record is expired once `ledger_timestamp > expires_at`.

### `CleanupStats`

Return value of `cleanup_expired_errors`.

| Field | Type | Description |
|---|---|---|
| `removed` | `u32` | Number of expired records deleted |
| `scanned` | `u32` | Total records examined |

---

## Public Functions

### Lifecycle Management

#### `initialize(env, admin) -> Result<(), Error>`

Initializes the contract and sets the admin address. Can only be called once.

| Parameter | Type | Description |
|---|---|---|
| `admin` | `Address` | Administrator address |

**Errors**: `AlreadyInitialized`

---

#### `admin(env) -> Option<Address>`

Returns the current admin address.

---

#### `contract_version(env) -> String`

Returns the deployed contract version string.

---

#### `upgrade(env, new_wasm_hash) -> Result<(), Error>`

Upgrades the contract to a new WASM binary.

| Parameter | Type | Description |
|---|---|---|
| `new_wasm_hash` | `BytesN<32>` | Hash of the new WASM binary |

**Auth**: Admin  
**Errors**: `Unauthorized`

---

### Error Reporting

#### `submit_error(env, error_id, error_code, message, agent_id, ttl_seconds) -> Result<(), Error>`

Submits a new error report. The contract stamps `created_at` and `expires_at`
from the ledger clock.

| Parameter | Type | Description |
|---|---|---|
| `error_id` | `BytesN<32>` | Unique error identifier (caller-supplied) |
| `error_code` | `u32` | Application error code (used for secondary lookup) |
| `message` | `Symbol` | Short error description |
| `agent_id` | `Symbol` | Reporting agent identifier |
| `ttl_seconds` | `u64` | How long this record should live (1 – `MAX_TTL_SECONDS`) |

**Errors**: `AlreadyExists`, `TtlZero`, `TtlOverflow`, `TtlAboveMax`

---

#### `get_error(env, error_id) -> Option<ErrorRecord>`

Returns the error record with the given ID, or `None` if it has expired or does not exist.

| Parameter | Type | Description |
|---|---|---|
| `error_id` | `BytesN<32>` | Error identifier to look up |

---

#### `get_errors_by_code(env, error_code) -> Vec<ErrorRecord>`

Returns all active error records with the specified error code. Expired records
are filtered out at read time.

| Parameter | Type | Description |
|---|---|---|
| `error_code` | `u32` | Error code to look up |

---

#### `count_active_by_code(env, error_code) -> u32`

Returns the count of active (non-expired) records for a given error code.

| Parameter | Type | Description |
|---|---|---|
| `error_code` | `u32` | Error code to count |

---

#### `cleanup_expired_errors(env, max_batch) -> CleanupStats`

Permissionless storage reclamation. Removes at most `max_batch` expired records
(capped at `MAX_CLEANUP_BATCH`). Active records are scanned but not counted
against the batch budget, so they cannot starve cleanup of expired records.

| Parameter | Type | Description |
|---|---|---|
| `max_batch` | `u32` | Maximum records to delete; `0` uses `DEFAULT_CLEANUP_BATCH` |

**Returns**: `CleanupStats` with `removed` and `scanned` counts  
**Auth**: None (permissionless)

---

## Events

This contract currently emits standard Soroban contract events. No custom event
types are defined in the ABI; errors are surfaced via return values.

---

## Error Codes

| Code | Name | Description |
|---|---|---|
| `1` | `AlreadyExists` | A record with this `error_id` already exists |
| `2` | `TtlZero` | `ttl_seconds` must be greater than zero |
| `3` | `TtlOverflow` | `created_at + ttl_seconds` overflows `u64` |
| `4` | `TtlAboveMax` | `ttl_seconds` exceeds `MAX_TTL_SECONDS` (90 days) |
| `5` | `AlreadyInitialized` | `initialize` called more than once |
| `6` | `Unauthorized` | Caller lacks required admin authorization |
| `7` | `NotInitialized` | Contract has not been initialized |

# ABI Reference — `task-store`

> **Source**: `smart-contracts/contracts/task_store/src/lib.rs`  
> **Crate name**: `task-store` (Cargo: `task_store`)  
> **Contract type**: `TaskStoreContract`

The Task Store contract manages task metadata persistence and a strictly-enforced
lifecycle state machine. It optionally integrates with an `OracleManager` contract
to stamp the current market price for a trading pair at task creation time.

---

## Constants

| Constant | Value | Description |
|---|---|---|
| `DEFAULT_TTL_DAYS` | `7` | Default task metadata TTL in days |
| `MAX_TTL_DAYS` | `30` | Maximum task metadata TTL in days |
| `MAX_COMPRESSED_DAG_BYTES` | `65_536` (64 KiB) | Maximum size of the compressed DAG bytes field |
| `TASK_LIFECYCLE_EVENT_VERSION` | `1` | Current task lifecycle event schema version |
| `LEDGERS_PER_DAY` | `17_280` | Approximate ledger count per day at 5 s/ledger |

---

## Types

### `TaskMetadata`

Stored task record.

| Field | Type | Description |
|---|---|---|
| `task_id` | `BytesN<32>` | Unique task identifier |
| `requester` | `Address` | Address that created the task |
| `agents` | `Vec<Address>` | Ordered list of agents assigned to this task |
| `dag` | `Bytes` | Compressed DAG representation (≤ `MAX_COMPRESSED_DAG_BYTES`) |
| `status` | `TaskStatus` | Current lifecycle status |
| `created_at` | `u64` | Ledger timestamp (seconds) at creation |
| `expires_at` | `u64` | Ledger timestamp (seconds) at which this record expires |
| `price_pair` | `Option<Symbol>` | Oracle price pair symbol (e.g. `XLM_USDC`), if requested |
| `quoted_price_stroops` | `Option<i128>` | Oracle price stamped at creation time, or `None` |

### `TaskStatus` (enum)

| Variant | Description |
|---|---|
| `Pending` | Task created, awaiting execution |
| `Running` | Task accepted by at least one agent |
| `Completed` | Task finished successfully (terminal) |
| `Failed` | Task ended with failure (terminal) |

### State Machine

Only the following transitions are valid:

```
Pending  →  Running
Pending  →  Failed
Running  →  Completed
Running  →  Failed
```

Any other transition is rejected with `InvalidTransition`.

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

Upgrades the contract WASM. The admin must authorize.

| Parameter | Type | Description |
|---|---|---|
| `new_wasm_hash` | `BytesN<32>` | Hash of the replacement WASM binary |

**Auth**: Admin  
**Errors**: `Unauthorized`

---

### Task Operations

#### `store_task_metadata(env, task_id, requester, agents, dag, ttl_days, price_pair) -> Result<(), Error>`

Creates a new task record. If an `OracleManager` is configured and `price_pair`
is `Some`, the current oracle price is stamped on the task. If the oracle is
configured but returns no usable price, the call is **rejected** with
`OraclePriceUnavailable`.

| Parameter | Type | Description |
|---|---|---|
| `task_id` | `BytesN<32>` | Unique task ID |
| `requester` | `Address` | Address submitting the task |
| `agents` | `Vec<Address>` | Agents assigned to the task (must not contain duplicates) |
| `dag` | `Bytes` | Compressed DAG bytes (≤ `MAX_COMPRESSED_DAG_BYTES`) |
| `ttl_days` | `u32` | Metadata TTL in days (`1` – `MAX_TTL_DAYS`; `0` uses `DEFAULT_TTL_DAYS`) |
| `price_pair` | `Option<Symbol>` | Oracle price pair to resolve, or `None` to skip |

**Auth**: Requester  
**Errors**: `AlreadyExists`, `DagTooLarge`, `DuplicateAgents`, `InvalidTtl`, `OraclePriceUnavailable`

---

#### `get_task_metadata(env, task_id) -> Result<TaskMetadata, Error>`

Returns the full task metadata record.

| Parameter | Type | Description |
|---|---|---|
| `task_id` | `BytesN<32>` | Task to retrieve |

**Errors**: `NotFound`, `Expired`

---

#### `get_task_status(env, task_id) -> Result<TaskStatus, Error>`

Returns the current status of a task.

| Parameter | Type | Description |
|---|---|---|
| `task_id` | `BytesN<32>` | Task to query |

**Errors**: `NotFound`, `Expired`

---

#### `update_task_status(env, task_id, caller, new_status) -> Result<(), Error>`

Transitions the task to a new status. Only the assigned agents or the admin may
call this. The transition must be valid according to the state machine.

| Parameter | Type | Description |
|---|---|---|
| `task_id` | `BytesN<32>` | Task to update |
| `caller` | `Address` | Caller attempting the transition (must be an assigned agent or admin) |
| `new_status` | `TaskStatus` | Target status |

**Auth**: Assigned agent or Admin  
**Errors**: `NotFound`, `Expired`, `Unauthorized`, `InvalidTransition`

---

### Oracle Configuration

#### `set_oracle_manager(env, oracle_manager) -> Result<(), Error>`

Configures the `OracleManager` contract address used for price stamping. Pass
`None` to clear the configured address.

| Parameter | Type | Description |
|---|---|---|
| `oracle_manager` | `Option<Address>` | OracleManager contract address, or `None` to disable |

**Auth**: Admin  
**Errors**: `Unauthorized`

---

## Events

### `TaskCreatedEvent`

Emitted when `store_task_metadata` succeeds.

| Field | Type | Description |
|---|---|---|
| `version` | `u32` | Event schema version (`TASK_LIFECYCLE_EVENT_VERSION`) |
| `task_id` | `BytesN<32>` | Created task ID |
| `requester` | `Address` | Task requester |
| `agent_count` | `u32` | Number of assigned agents |
| `ttl_days` | `u32` | Configured TTL |
| `quoted_price_stroops` | `Option<i128>` | Oracle price at creation, if resolved |

---

### `TaskUpdatedEvent`

Emitted for each non-terminal status transition (`Pending → Running`).

| Field | Type | Description |
|---|---|---|
| `version` | `u32` | Event schema version |
| `task_id` | `BytesN<32>` | Updated task ID |
| `old_status` | `TaskStatus` | Previous status |
| `new_status` | `TaskStatus` | New status |
| `caller` | `Address` | Address that triggered the transition |

---

### `TaskFinalizedEvent`

Emitted for terminal status transitions (`→ Completed` or `→ Failed`).

| Field | Type | Description |
|---|---|---|
| `version` | `u32` | Event schema version |
| `task_id` | `BytesN<32>` | Finalized task ID |
| `final_status` | `TaskStatus` | Terminal status (`Completed` or `Failed`) |
| `caller` | `Address` | Address that triggered finalization |

---

### `OracleManagerSetEvent`

Emitted when `set_oracle_manager` changes the configured address.

| Field | Type | Description |
|---|---|---|
| `old_manager` | `Option<Address>` | Previous oracle manager address |
| `new_manager` | `Option<Address>` | New oracle manager address |

---

## Error Codes

| Code | Name | Description |
|---|---|---|
| `1` | `NotFound` | No task record exists for the given ID |
| `2` | `AlreadyExists` | A task with this ID has already been stored |
| `3` | `Expired` | Task record has passed its TTL |
| `4` | `InvalidTransition` | The requested status transition is not allowed |
| `5` | `Unauthorized` | Caller is not an assigned agent or admin |
| `6` | `DagTooLarge` | `dag` field exceeds `MAX_COMPRESSED_DAG_BYTES` |
| `7` | `DuplicateAgents` | `agents` list contains duplicate addresses |
| `8` | `InvalidTtl` | `ttl_days` is 0 or exceeds `MAX_TTL_DAYS` |
| `9` | `OraclePriceUnavailable` | Oracle was configured, a pair was requested, but no usable price was returned |
| `10` | `AlreadyInitialized` | `initialize` called more than once |
| `11` | `NotInitialized` | Contract has not been initialized |

# ABI Reference — `agent-governance`

> **Source**: `smart-contracts/contracts/agent_governance/src/lib.rs`  
> **Crate name**: `agent-governance` (Cargo: `agent_governance`)  
> **Contract type**: `AgentGovernanceContract`

The Agent Governance contract implements on-chain weighted voting for protocol
parameter changes. Voting power is proportional to an agent's staked amount and
reputation score. A proposal passes when it achieves quorum and a majority of
non-abstain votes.

---

## Types

### `AgentInfo`

Registered voter record.

| Field | Type | Description |
|---|---|---|
| `address` | `Address` | Agent's Stellar address |
| `stake` | `i128` | Staked XLM amount in stroops |
| `reputation` | `u32` | Reputation score (0–100) |
| `voting_power` | `i128` | Computed voting power (`stake × reputation`) |

### `Proposal`

On-chain governance proposal.

| Field | Type | Description |
|---|---|---|
| `id` | `u64` | Unique proposal identifier |
| `proposer` | `Address` | Address that created the proposal |
| `proposal_type` | `ProposalType` | Category of the proposed change |
| `metadata` | `String` | Human-readable description |
| `deadline` | `u64` | Ledger timestamp after which voting closes |
| `status` | `ProposalStatus` | Current proposal status |
| `votes_for` | `i128` | Accumulated weighted votes in favour |
| `votes_against` | `i128` | Accumulated weighted votes against |
| `votes_abstain` | `i128` | Accumulated abstain votes (count towards quorum) |
| `total_power_snapshot` | `i128` | Total voting power at proposal creation time |

### `ProposalStatus` (enum)

| Variant | Description |
|---|---|
| `Active` | Voting period is open |
| `Passed` | Quorum and majority achieved |
| `Failed` | Did not pass quorum or majority |
| `Executed` | Outcome was enacted on-chain |

### `ProposalType` (enum)

| Variant | Description |
|---|---|
| `ParameterChange` | Modify a protocol parameter |
| `AgentSuspension` | Suspend a misbehaving agent |
| `BondAdjustment` | Change the minimum registration bond |
| `EmergencyPause` | Emergency circuit-breaker action |

### `VoteRecord`

A voter's recorded vote.

| Field | Type | Description |
|---|---|---|
| `voter` | `Address` | Voter address |
| `choice` | `VoteChoice` | `For`, `Against`, or `Abstain` |
| `power` | `i128` | Voting power cast with this vote |

### `VoteChoice` (enum)

| Variant | Description |
|---|---|
| `For` | Vote in favour |
| `Against` | Vote against |
| `Abstain` | Counted for quorum but not majority |

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

### Agent Registration (Voting Eligibility)

#### `register_agent(env, agent, stake, reputation) -> Result<(), Error>`

Registers an agent as an eligible voter. Voting power = `stake × reputation`.

| Parameter | Type | Description |
|---|---|---|
| `agent` | `Address` | Agent's address |
| `stake` | `i128` | Staked amount in stroops (must be > 0) |
| `reputation` | `u32` | Reputation score (0–`MAX_REPUTATION`) |

**Auth**: Agent  
**Errors**: `AlreadyRegistered`, `InvalidReputation`, `InvalidStake`

---

#### `update_agent(env, agent, stake, reputation) -> Result<(), Error>`

Updates stake and reputation for a registered voter. Adjusts total voting power.

| Parameter | Type | Description |
|---|---|---|
| `agent` | `Address` | Agent to update |
| `stake` | `i128` | New stake amount in stroops |
| `reputation` | `u32` | New reputation score |

**Auth**: Agent  
**Errors**: `NotRegistered`, `InvalidReputation`, `InvalidStake`

---

#### `get_agent(env, agent) -> Option<AgentInfo>`

Returns the registration record for a voter, or `None` if not registered.

---

### Governance Proposals

#### `create_proposal(env, proposer, proposal_type, metadata, voting_period_secs) -> Result<u64, Error>`

Creates a new governance proposal. Returns the proposal ID.

| Parameter | Type | Description |
|---|---|---|
| `proposer` | `Address` | Registered agent creating the proposal |
| `proposal_type` | `ProposalType` | Category of the change |
| `metadata` | `String` | Description of the proposed change (must not be empty) |
| `voting_period_secs` | `u64` | How long the voting window stays open |

**Auth**: Proposer (must be a registered agent)  
**Errors**: `NotRegistered`, `EmptyMetadata`, `InvalidVotingPeriod`

---

#### `vote_on_proposal(env, voter, proposal_id, choice) -> Result<(), Error>`

Casts a vote on an active proposal.

| Parameter | Type | Description |
|---|---|---|
| `voter` | `Address` | Registered voter |
| `proposal_id` | `u64` | Target proposal |
| `choice` | `VoteChoice` | `For`, `Against`, or `Abstain` |

**Auth**: Voter (must be a registered agent)  
**Errors**: `NotRegistered`, `ProposalNotFound`, `VotingClosed`, `AlreadyVoted`

---

#### `execute_proposal(env, proposal_id) -> Result<ProposalStatus, Error>`

Evaluates and executes a proposal after its voting deadline. Checks quorum and
majority, then marks the proposal `Passed` + `Executed` or `Failed`.

| Parameter | Type | Description |
|---|---|---|
| `proposal_id` | `u64` | Proposal to execute |

**Returns**: Final `ProposalStatus`  
**Errors**: `ProposalNotFound`, `VotingStillOpen`, `AlreadyExecuted`, `QuorumNotMet`, `MajorityNotMet`

---

### Query Functions

#### `get_proposal(env, id) -> Option<Proposal>`

Returns the full proposal record by ID.

---

#### `get_vote(env, proposal_id, voter) -> Option<VoteRecord>`

Returns a specific voter's record for a proposal.

---

#### `get_total_voting_power(env) -> i128`

Returns the total voting power of all registered agents.

---

#### `get_proposal_count(env) -> u64`

Returns the total number of proposals ever created.

---

## Events

### `ProposalCreatedEvent`

Emitted when a new proposal is created.

| Field | Type | Description |
|---|---|---|
| `id` | `u64` | Proposal identifier |
| `proposer` | `Address` | Proposal creator |
| `proposal_type` | `ProposalType` | Proposal category |
| `deadline` | `u64` | Voting deadline timestamp |

---

### `VoteCastEvent`

Emitted when a vote is recorded.

| Field | Type | Description |
|---|---|---|
| `proposal_id` | `u64` | Target proposal |
| `voter` | `Address` | Voter address |
| `choice` | `VoteChoice` | Vote choice |
| `power` | `i128` | Voting power cast |

---

### `ProposalExecutedEvent`

Emitted when a proposal is evaluated after deadline.

| Field | Type | Description |
|---|---|---|
| `proposal_id` | `u64` | Evaluated proposal |
| `status` | `ProposalStatus` | Final status (`Passed`/`Failed`/`Executed`) |
| `votes_for` | `i128` | Final for-votes |
| `votes_against` | `i128` | Final against-votes |

---

### `AgentRegisteredEvent` (governance)

Emitted when a new agent is registered as a voter.

| Field | Type | Description |
|---|---|---|
| `agent` | `Address` | Registered agent |
| `voting_power` | `i128` | Initial voting power |

---

## Quorum & Majority Calculation

```
total_votes     = votes_for + votes_against + votes_abstain
quorum_met      = total_votes  / total_power_snapshot >= quorum_threshold
majority_met    = votes_for    / (votes_for + votes_against) > 0.5
```

Abstain votes contribute to `total_votes` for quorum but are excluded from
the majority fraction.

---

## Error Codes

| Code | Name | Description |
|---|---|---|
| `1` | `NotRegistered` | Agent is not registered as a voter |
| `2` | `AlreadyRegistered` | Agent is already registered |
| `3` | `ProposalNotFound` | No proposal exists with the given ID |
| `4` | `VotingClosed` | Voting period has ended |
| `5` | `VotingStillOpen` | `execute_proposal` called before deadline |
| `6` | `AlreadyVoted` | This voter has already voted on the proposal |
| `7` | `AlreadyExecuted` | `execute_proposal` called more than once |
| `8` | `QuorumNotMet` | Insufficient participation |
| `9` | `MajorityNotMet` | Insufficient for-votes to pass |
| `10` | `EmptyMetadata` | Proposal metadata string is empty |
| `11` | `InvalidVotingPeriod` | Voting period is out of allowed range |
| `12` | `InvalidReputation` | Reputation score exceeds `MAX_REPUTATION` |
| `13` | `InvalidStake` | Stake must be greater than zero |
| `14` | `AlreadyInitialized` | `initialize` called more than once |
| `15` | `Unauthorized` | Caller lacks required authorization |

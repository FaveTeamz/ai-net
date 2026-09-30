# ABI Reference — `agent-bidding`

> **Source**: `smart-contracts/contracts/agent_bidding/src/lib.rs`  
> **Crate name**: `agent-bidding`  
> **Contract type**: `AgentBiddingContract`

The Agent Bidding contract implements a sealed-bid auction mechanism for
allocating AI tasks to agents. Agents submit cryptographic commitments during a
bidding window, then reveal their plaintext bids in a separate reveal phase. The
contract selects a winner using a weighted score (60% price, 40% reputation).

For the full threat model see
[`docs/agent-bidding-security.md`](../agent-bidding-security.md).

---

## Constants

| Constant | Value | Description |
|---|---|---|
| `COMMITMENT_DOMAIN` | `b"ai-net-bid-v1"` | Domain separator for commitment hashes |
| `DEFAULT_BIDDING_DURATION_SECS` | `3600` (1 h) | Default bidding window duration |
| `DEFAULT_REVEAL_DURATION_SECS` | `1800` (30 min) | Default reveal window duration |
| `MIN_PHASE_DURATION_SECS` | `300` (5 min) | Minimum allowed phase duration |
| `MAX_PHASE_DURATION_SECS` | `604800` (7 d) | Maximum allowed phase duration |
| `MAX_BIDDERS` | `50` | Maximum bidders per auction |
| `MAX_BID_PRICE` | `1_000_000_000_000` | Maximum allowed bid price in stroops |
| `MAX_REPUTATION` | `100` | Maximum reputation score |
| `MAX_TERMS_LEN` | `256` | Maximum length of terms string (bytes) |
| `PRICE_WEIGHT` | `60` | Weight for price component in scoring |
| `REPUTATION_WEIGHT` | `40` | Weight for reputation component in scoring |
| `SCORE_SCALE` | `1000` | Score normalization scale |

---

## Types

### `AuctionConfig`

Parameters provided when creating an auction.

| Field | Type | Description |
|---|---|---|
| `task_id` | `Symbol` | Unique task identifier |
| `bidding_duration_secs` | `u64` | Bidding window length in seconds |
| `reveal_duration_secs` | `u64` | Reveal window length in seconds |
| `reserve_price` | `i128` | Minimum accepted bid price in stroops |
| `price_cap` | `i128` | Maximum accepted bid price in stroops |
| `required_bond` | `i128` | Bond agents must lock to participate |

### `Auction`

Stored auction state.

| Field | Type | Description |
|---|---|---|
| `task_id` | `Symbol` | Task identifier |
| `creator` | `Address` | Address that created the auction |
| `config` | `AuctionConfig` | Auction configuration parameters |
| `phase` | `AuctionPhase` | Current phase |
| `deadline` | `u64` | Ledger timestamp when bidding closes |
| `reveal_deadline` | `u64` | Ledger timestamp when reveal window closes |
| `bid_count` | `u32` | Number of submitted bids |

### `AuctionPhase` (enum)

| Variant | Description |
|---|---|
| `Bidding` | Accepting sealed bid commitments |
| `Reveal` | Reveal window open; finalised after `reveal_bids` |
| `Awarded` | Winner selected and escrow created |
| `Cancelled` | Aborted; all bonds released |

### `SealedBid`

An agent's committed bid.

| Field | Type | Description |
|---|---|---|
| `bidder` | `Address` | Bidding agent's address |
| `commitment` | `BytesN<32>` | SHA-256 commitment hash |
| `reputation` | `u32` | Self-declared reputation score (0–100) |
| `bond` | `i128` | Bond locked with this bid |
| `submitted_at` | `u64` | Ledger timestamp of submission |
| `revealed` | `bool` | Whether the bid has been revealed |

### `Escrow`

Payment escrow created upon contract award.

| Field | Type | Description |
|---|---|---|
| `task_id` | `Symbol` | Associated task |
| `winner` | `Address` | Winning agent address |
| `amount` | `i128` | Escrowed payment amount in stroops |
| `created_at` | `u64` | Ledger timestamp of escrow creation |

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

---

### Auction Operations

#### `create_auction(env, caller, config) -> Result<(), Error>`

Creates a new sealed-bid auction for a task. Sets phase to `Bidding`.

| Parameter | Type | Description |
|---|---|---|
| `caller` | `Address` | Task creator (must authorize) |
| `config` | `AuctionConfig` | Auction parameters |

**Auth**: Caller  
**Errors**: `DuplicateAuction`, `InvalidPriceRange`, `InvalidDuration`, `PriceAboveCeiling`

---

#### `submit_bid(env, task_id, bidder, commitment, reputation) -> Result<(), Error>`

Submits a sealed bid commitment during the bidding window. Locks the required bond.

| Parameter | Type | Description |
|---|---|---|
| `task_id` | `Symbol` | Auction to bid on |
| `bidder` | `Address` | Bidding agent's address |
| `commitment` | `BytesN<32>` | SHA-256 commitment: `H(domain ∥ contract_id ∥ task_id ∥ bidder ∥ price ∥ terms ∥ salt)` |
| `reputation` | `u32` | Self-declared reputation score (0–`MAX_REPUTATION`) |

**Auth**: Bidder  
**Errors**: `AuctionNotFound`, `BiddingWindowClosed`, `MaxBiddersReached`, `DuplicateBid`, `InvalidReputation`, `WrongBond`

---

#### `reveal_bid(env, task_id, bidder, price, terms, salt) -> Result<(), Error>`

Reveals the plaintext bid during the reveal window. The contract recomputes and verifies the commitment.

| Parameter | Type | Description |
|---|---|---|
| `task_id` | `Symbol` | Auction to reveal bid for |
| `bidder` | `Address` | Revealing bidder's address |
| `price` | `i128` | Plaintext bid price in stroops |
| `terms` | `String` | Service terms string (≤ `MAX_TERMS_LEN` bytes) |
| `salt` | `BytesN<32>` | Random salt used when computing the commitment |

**Auth**: Bidder  
**Errors**: `AuctionNotFound`, `NotInRevealWindow`, `BidNotFound`, `AlreadyRevealed`, `WrongCommitment`, `PriceBelowReserve`, `PriceAboveCap`, `TermsTooLong`

---

#### `reveal_bids(env, caller, task_id) -> Result<(), Error>`

Finalises the reveal phase and selects a winner. Callable only after the reveal deadline or when all bids have been revealed.

| Parameter | Type | Description |
|---|---|---|
| `caller` | `Address` | Address triggering finalisation |
| `task_id` | `Symbol` | Auction to finalise |

**Auth**: Caller (any address)  
**Errors**: `AuctionNotFound`, `RevealWindowStillOpen`, `NoBidsRevealed`

---

#### `award_contract(env, caller, task_id) -> Result<(), Error>`

Creates the payment escrow for the winning bid. Refunds revealed bidders' bonds; forfeits bonds of non-revealers.

| Parameter | Type | Description |
|---|---|---|
| `caller` | `Address` | Creator or winner |
| `task_id` | `Symbol` | Auction to award |

**Auth**: Creator or winner  
**Errors**: `AuctionNotFound`, `RevealPhaseNotComplete`, `NoWinnerSelected`, `UnrelatedCaller`, `AlreadyAwarded`

---

#### `abort_auction(env, caller, task_id) -> Result<(), Error>`

Emergency abort for auctions where the reveal window closed with zero reveals. Releases all bonds.

| Parameter | Type | Description |
|---|---|---|
| `caller` | `Address` | Auction creator |
| `task_id` | `Symbol` | Auction to abort |

**Auth**: Creator  
**Errors**: `AuctionNotFound`, `AbortRejected` (if a bid was revealed or window still open)

---

#### `claim_bid_refund(env, task_id, bidder) -> Result<(), Error>`

Allows a revealed bidder to claim their bond refund after the auction ends.

| Parameter | Type | Description |
|---|---|---|
| `task_id` | `Symbol` | Auction |
| `bidder` | `Address` | Bidder claiming refund |

**Auth**: Bidder

---

### Query Functions

#### `commitment_of(env, task_id, bidder, price, terms, salt) -> BytesN<32>`

Computes the expected commitment hash for given bid parameters. Use this off-chain to generate a valid `submit_bid` commitment.

| Parameter | Type | Description |
|---|---|---|
| `task_id` | `Symbol` | Auction task ID |
| `bidder` | `Address` | Bidder address |
| `price` | `i128` | Bid price in stroops |
| `terms` | `String` | Service terms string |
| `salt` | `BytesN<32>` | Random salt |

**Returns**: `BytesN<32>` — SHA-256 commitment hash

---

#### `get_auction(env, task_id) -> Option<Auction>`

Returns the full auction record, or `None` if not found.

---

#### `get_bid(env, task_id, bidder) -> Option<SealedBid>`

Returns a specific bidder's sealed bid record.

---

#### `get_escrow(env, task_id) -> Option<Escrow>`

Returns the escrow record created upon contract award.

---

#### `get_winner(env, task_id) -> Option<Address>`

Returns the winning bidder's address after `reveal_bids` finalises the auction.

---

#### `get_bidder_count(env, task_id) -> u32`

Returns the number of submitted bids for an auction.

---

#### `get_bidders(env, task_id, start, limit) -> Vec<Address>`

Returns a paginated slice of bidder addresses for an auction.

| Parameter | Type | Description |
|---|---|---|
| `task_id` | `Symbol` | Auction |
| `start` | `u32` | Zero-based start index |
| `limit` | `u32` | Maximum addresses to return |

---

## Scoring Algorithm

```
price_score = 1000 × (max_price − price) / max(max_price − min_price, 1)
rep_score   = 1000 × (rep − min_rep)     / max(max_rep   − min_rep,   1)
score       = (60 × price_score + 40 × rep_score) / 100
```

Tie-break order: highest score → lowest price → earliest submission.

---

## Commitment Hash

```
SHA-256(
    domain_xdr       ∥
    contract_id_xdr  ∥
    task_id_xdr      ∥
    bidder_xdr       ∥
    price_xdr        ∥
    terms_xdr        ∥
    salt_xdr
)
```

All fields are serialised to their Stellar XDR wire format. Use
`AgentBiddingContract::commitment_of` to produce a valid hash.

---

## Events

### `AuctionCreatedEvent`

| Field | Type | Description |
|---|---|---|
| `task_id` | `Symbol` | Created auction's task ID |
| `creator` | `Address` | Auction creator |
| `deadline` | `u64` | Bidding deadline timestamp |
| `reveal_deadline` | `u64` | Reveal deadline timestamp |

---

### `BidSubmittedEvent`

| Field | Type | Description |
|---|---|---|
| `task_id` | `Symbol` | Auction task ID |
| `bidder` | `Address` | Bidding agent |
| `commitment` | `BytesN<32>` | Submitted commitment hash |

---

### `BidRevealedEvent`

| Field | Type | Description |
|---|---|---|
| `task_id` | `Symbol` | Auction task ID |
| `bidder` | `Address` | Revealing bidder |
| `price` | `i128` | Revealed price in stroops |

---

### `BidsRevealedEvent`

Emitted by `reveal_bids` when the auction is finalised.

| Field | Type | Description |
|---|---|---|
| `task_id` | `Symbol` | Auction task ID |
| `winner` | `Address` | Selected winner |
| `winning_price` | `i128` | Winner's revealed price in stroops |

---

### `ContractAwardedEvent`

| Field | Type | Description |
|---|---|---|
| `task_id` | `Symbol` | Awarded auction |
| `winner` | `Address` | Winning agent |
| `escrow_amount` | `i128` | Escrowed payment amount |

---

### `AuctionAbortedEvent`

| Field | Type | Description |
|---|---|---|
| `task_id` | `Symbol` | Aborted auction |
| `bonds_released` | `u32` | Number of bonds released |

---

## Error Codes

| Code | Name | Description |
|---|---|---|
| `1` | `AuctionNotFound` | No auction exists for the given `task_id` |
| `2` | `DuplicateAuction` | An auction for this `task_id` already exists |
| `3` | `BiddingWindowClosed` | Bid submitted after the bidding deadline |
| `4` | `RevealWindowClosed` | Reveal attempted outside the reveal window |
| `5` | `RevealWindowStillOpen` | `reveal_bids` called before reveal deadline and bids remain |
| `6` | `MaxBiddersReached` | Auction is at `MAX_BIDDERS` capacity |
| `7` | `DuplicateBid` | This bidder has already submitted a bid |
| `8` | `BidNotFound` | No sealed bid exists for this bidder |
| `9` | `AlreadyRevealed` | Bid has already been revealed |
| `10` | `WrongCommitment` | Revealed data does not match the commitment |
| `11` | `InvalidReputation` | Reputation exceeds `MAX_REPUTATION` |
| `12` | `WrongBond` | Bond amount does not match `required_bond` |
| `13` | `PriceBelowReserve` | Revealed price is below `reserve_price` |
| `14` | `PriceAboveCap` | Revealed price exceeds `price_cap` |
| `15` | `TermsTooLong` | Terms string exceeds `MAX_TERMS_LEN` |
| `16` | `NoBidsRevealed` | `reveal_bids` called but no bids were revealed |
| `17` | `RevealPhaseNotComplete` | `award_contract` called before `reveal_bids` |
| `18` | `NoWinnerSelected` | No winner was determined during reveal phase |
| `19` | `AlreadyAwarded` | `award_contract` called twice |
| `20` | `UnrelatedCaller` | Caller is neither creator nor winner |
| `21` | `AbortRejected` | Auction cannot be aborted (reveal active or bids revealed) |
| `22` | `InvalidPriceRange` | `reserve_price` ≥ `price_cap` |
| `23` | `InvalidDuration` | Phase duration outside allowed range |
| `24` | `PriceAboveCeiling` | `price_cap` exceeds `MAX_BID_PRICE` |
| `25` | `AlreadyInitialized` | `initialize` called more than once |
| `26` | `Unauthorized` | Caller lacks required authorization |
| `27` | `NotInitialized` | Contract has not been initialized |

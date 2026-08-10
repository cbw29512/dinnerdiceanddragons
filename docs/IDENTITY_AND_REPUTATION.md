# Dinner, Dice & Dragons — Identity, Abuse Prevention, and Reputation

## Objective

Create enough friction to discourage trolling and impersonation without making normal local tabletop participation difficult.

The platform must distinguish:

1. **Identity** — who the account is.
2. **Roles** — what that identity is allowed to do.
3. **Experience** — what the user says about their RPG background.
4. **Reputation** — what verified platform activity demonstrates.
5. **Moderation** — private safety/abuse decisions.

These are separate systems.

---

## Identity model

Each person has one durable `User.id` regardless of whether they participate as Player, GM, or Venue Manager.

Public display names are unique after normalization.

Example normalization:

```text
"  Pinkie  " -> "pinkie"
"PINKIE"     -> "pinkie"
"Pinkie"     -> "pinkie"
```

All three therefore conflict.

Reserve platform/system identities such as:

- admin
- administrator
- moderator
- mod
- support
- staff
- dinnerdiceanddragons
- dinner dice & dragons
- official

The underlying immutable User ID remains the authoritative identity even if display-name changes are permitted later.

---

## Account activation

Anonymous visitors may browse public tables and public-safe venue/game information.

Account-required actions:

- create a Player or GM demand/supply signal
- create or claim a venue
- join/request a seat
- create a forming table
- send messages
- submit feedback
- submit reports
- record attendance

Before activation:

1. bot/abuse challenge where appropriate
2. email ownership verification
3. unique display-name selection
4. Code of Conduct acceptance
5. account created in `active` state unless policy/risk rules require review

Production authentication should use a mature identity provider rather than custom password/cryptography code.

---

## Multi-role accounts

A User may hold multiple roles:

```text
User
 ├── Player
 ├── GM
 └── Venue Manager (only after venue verification)
```

Do not require separate accounts for Player and GM activity.

Role permissions must be enforced server-side in production.

---

## New-account restrictions

New users are not low-reputation, but they may have lower **action limits** until account legitimacy is established.

Examples for policy tuning:

- join/request rate limit
- message rate limit
- game-creation rate limit
- report rate limit
- venue-claim rate limit

These controls protect the platform from spam without reducing Table Match score or ordinary discovery eligibility.

**Trust-neutral is not the same as unlimited permissions.**

---

## Blocking

Blocking is a direct-interaction safety control, not a reputation event.

A blocked user should not be able to:

- send direct messages to the blocker
- repeatedly invite/request the blocker into private or approval-required interactions
- use notifications to harass the blocker

Shared public-table behavior requires policy-specific handling so essential Game Hub/system logistics still function where necessary.

Block relationships are private.

---

## Venue verification

A user claiming to represent a venue does not gain official venue-manager permissions immediately.

Venue claim lifecycle:

```text
claim submitted
    -> business/ownership evidence
    -> pending review/verification
    -> approved venue manager
```

Until verified, a claimant cannot speak officially for the venue, approve/cancel bookings, or modify existing venue operations.

---

## Reputation philosophy

**Everyone gets a fair first table.**

No history is neutral.

Reputation reduces uncertainty after verified interactions; it does not determine who deserves access to ordinary Table Match opportunities.

Table Match order:

1. hard logistical fit
2. table/preference fit
3. reputation only as limited context/tie-breaking/caution after viability

Missing history never subtracts fit points.

---

## Reputation states

### New to DDD
Insufficient verified platform history.

Public display examples:

- `New to DDD`
- `No verified platform sessions yet`
- `12 years GMing · self-reported`

Never display `0% reliability` or `0 stars` for missing history.

### Building History
Some verified activity but insufficient sample size for one or more public aggregates.

### Established
Enough eligible verified evidence for statistically meaningful public-safe aggregate signals.

### Caution
A verified reliability pattern crosses a published threshold. This is not triggered by a single complaint or one poor review.

### Restricted / Suspended
Moderation/account state, separate from popularity/reputation scoring.

---

## Reputation Ledger

Public reputation is derived from immutable evidence records created from verified platform interactions.

Examples:

- session_attended
- session_hosted_completed
- venue_hosted_completed
- late_cancel
- no_show
- gm_description_accurate
- gm_boundaries_respected
- gm_would_play_again
- venue_information_accurate
- venue_would_return

Clients never directly create arbitrary reputation events.

The system derives them from authoritative records such as Attendance, completed Events, eligible Feedback, and verified Venue sessions.

---

## Feedback eligibility

A user can submit reputation-bearing feedback only when the platform can prove an eligible relationship to the completed Event.

Examples:

- confirmed/attended Player -> GM feedback
- GM -> table-level feedback
- eligible Player/GM -> Venue feedback
- Venue Manager -> table-level operational feedback

Drive-by public ratings are prohibited.

Free-text comments are private by default.

---

## Minimum sample thresholds

Do not publish fragile percentages from tiny samples.

Example policy concept:

- 0 verified responses -> `Not enough history yet`
- 1–4 responses -> `Building History`, hide percentage
- 5+ eligible responses -> percentage may be shown

The final thresholds should be policy-configurable rather than hard-coded into presentation code.

---

## Anti-gaming rules

- one verified interaction cannot generate unlimited feedback
- duplicate feedback for the same subject/event relationship is rejected
- deleted/banned sockpuppet patterns may be investigated by moderation
- reputation snapshots are recalculated from evidence, not directly editable counters
- venue/GM/Player reputation dimensions remain role-specific
- account-age alone is not treated as quality
- high activity volume does not automatically mean high reputation

---

## Fair-discovery monitoring

Measure whether newcomer status creates unintended disadvantage.

Compare `new`, `building`, and `established` eligible users on:

- eligible match count
- discovery impressions
- invitations / join opportunities
- accepted/confirmed tables
- successful played sessions

If newcomer conversion is materially worse after controlling for actual Table Fit, investigate ranking and presentation bias.

---

## Production controls

Before a public launch, implement and test:

- unique normalized display names
- verified email activation
- bot/signup abuse protection
- role-based authorization
- server-side rate limiting
- block relationships
- venue claim verification
- feedback eligibility enforcement
- immutable reputation ledger
- aggregate sample thresholds
- private reporting/moderation separation
- audit logs for privileged actions
- fair-discovery telemetry

## Non-goals

- social follower counts
- popularity leaderboards
- public accusation feeds
- purchasable reputation
- paying for higher trust scores
- requiring established reputation to access ordinary matching

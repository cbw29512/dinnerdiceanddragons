# Production Identity Implementation Checklist

Do not enable unrestricted public participation until these controls are implemented and tested.

## Authentication
- [x] Select mature authentication provider — Supabase Auth (see `docs/DECISIONS.md`, Decision 016)
- [ ] Verified email required for active account
- [ ] Bot/signup-abuse protection enabled
- [ ] Disposable-email policy evaluated
- [ ] Account lockout / brute-force protection verified

## Identity
- [ ] Immutable internal User ID
- [ ] Unique normalized display name
- [ ] Reserved display-name list
- [ ] Safe display-name change policy
- [ ] One account may hold Player + GM roles

## Authorization
- [ ] Anonymous = browse-only
- [ ] Player permissions enforced server-side
- [ ] GM permissions enforced server-side
- [ ] Venue Manager requires verified venue claim
- [ ] Moderator/Admin privileged actions audited

## Abuse controls
- [ ] Message rate limits
- [ ] Join/request rate limits
- [ ] Game-creation rate limits
- [ ] Report rate limits
- [ ] Venue-claim rate limits
- [ ] Block-user relationships

## Reputation
- [ ] ReputationEvent immutable ledger
- [ ] Feedback eligibility tied to completed Event
- [ ] Duplicate feedback prevention
- [ ] ReputationSnapshot derived from evidence
- [ ] `New to DDD` neutral state
- [ ] Minimum sample threshold before percentages
- [ ] Self-reported experience visibly separate
- [ ] Reputation cannot subtract Table Fit for missing history
- [ ] FairDiscoveryAudit telemetry

## Moderation
- [ ] Private Report records
- [ ] ModerationCase workflow
- [ ] Reports do not automatically modify public reputation
- [ ] Attendance/source-record correction path
- [ ] Suspension/ban authorization enforced server-side

## Venue verification
- [ ] Venue claim lifecycle
- [ ] Evidence/review process
- [ ] Pending claimant cannot modify official venue operations
- [ ] Verified manager actions logged

## Release gate

Public launch is blocked until the identity, authorization, abuse, and feedback-eligibility controls above have security tests and documented expected behavior.

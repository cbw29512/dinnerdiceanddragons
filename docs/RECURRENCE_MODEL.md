# Dinner, Dice & Dragons — Recurring Schedule Model

## Purpose

Recurring availability and recurring game series must be easy to create, predictable to preview, and safe to change without destroying the whole series.

## Supported patterns

A Player, GM, or Venue may save multiple recurring rules. Rules are combined as an OR set.

Examples:
- every Wednesday
- every other Wednesday
- every 3 weeks on Friday
- first Sunday of every month
- last Saturday of every month
- second Sunday every 2 months

## Deterministic anchors

Multi-cycle patterns require an anchor occurrence:

- every N weeks where N > 1 requires one real date in the intended weekly cycle
- every N months where N > 1 requires one real date/month in the intended monthly cycle

The system must never guess which alternating cycle the user meant.

## Calendar preview

Every recurring rule should preview at least the next six generated occurrences before saving.

The preview exists to answer: “Are these the dates I actually meant?”

## Exceptions

An exception changes one generated occurrence without modifying the base recurring rule.

Supported exception actions:
- `skip` — this occurrence does not happen
- `move` — this occurrence is rescheduled to a specific replacement date

Example:

Base rule: `Last Saturday of every month`

Generated:
- Aug 29
- Sep 26
- Oct 31
- Nov 28

Exception:
- Oct 31 → move to Oct 24

The November occurrence remains Nov 28 because the base rule did not change.

## Persistence model

### RecurrenceException

`id`, `recurring_rule_id`, `original_date`, `action`, `replacement_date` nullable, `reason` nullable, `created_by_user_id`, `created_at`, `updated_at`

Actions: `skip`, `move`

Unique: `(recurring_rule_id, original_date)`

## Game series behavior

A recurring availability rule is an opportunity pattern. A confirmed recurring GameSeries creates individual Event/session records.

Each Event remains independently:
- confirmable
- cancellable
- reschedulable
- completable
- attendance-bearing

Editing one session must not silently mutate the entire series.

Changing the base series rule should require the user to choose an explicit scope such as:
- this session only
- this and future sessions
- entire series

## Matching behavior

Recurring Table Match should compare actual generated occurrence dates rather than only comparing labels such as “every other Wednesday.”

A recurring match should show:
- number of upcoming occurrences that align
- first conflicting date, if any
- Player demand coverage by occurrence
- Venue availability coverage by occurrence
- GM availability coverage by occurrence

The system may recommend a recurring series only when enough future occurrences are viable to justify it.

## UX rules

1. Show actual dates before saving.
2. Never guess alternating cycles.
3. Make exceptions visible.
4. Skipping/moving one date does not rewrite the recurring rule.
5. Cancellation remains separate from recurrence editing.
6. The user must understand the scope of any series-wide change before saving it.

# Dinner, Dice & Dragons — Cancellation & Recovery Policy

## Core rule

Plans change. A responsible cancellation is better than a no-show.

Cancellation is a normal lifecycle action for Players, Game Masters, and Venues. It is not misconduct by default and should not create a public penalty merely because it happened.

## Cancellation classes

Initial prototype policy bands:

- **Early cancellation** — more than 24 hours before session start.
- **Late cancellation** — less than 24 hours before session start.
- **Very late / same-day cancellation** — close enough to the session that replacement becomes materially harder.
- **No-show** — participant does not attend and did not cancel.

The exact production thresholds may change after pilot data, but the categories must remain distinct.

## Player cancellation

A Player may cancel a confirmed seat at any time.

When a Player cancels:

1. registration changes from `confirmed` to `cancelled`;
2. expected venue headcount decreases immediately;
3. first eligible waitlisted Player is offered/promoted according to table policy;
4. GM and venue receive updated headcount;
5. table status is recalculated;
6. if confirmed Players fall below the minimum and no replacement is available, the table returns to `forming`;
7. future recurring-session registrations remain unchanged unless the Player explicitly leaves the series.

### Reputation effect

- Early cancellation: no negative reputation event by default.
- Late cancellation: may create a `late_cancel` evidence event.
- No-show: creates a separate `no_show` evidence event after attendance reconciliation.
- One late cancellation or no-show must not automatically create a public caution state.
- Excused/emergency circumstances may be recorded without treating the event as a no-show.

## GM cancellation

A GM may cancel an individual session when they cannot run it.

When a GM cancels:

1. the session changes to `cancelled`;
2. all confirmed Players and the venue are notified immediately;
3. Player attendance/reliability is not penalized;
4. the venue is not penalized;
5. calendar/reminder state is updated;
6. future recurring sessions remain scheduled unless the GM explicitly cancels the series or selected future sessions;
7. the platform may offer reschedule/recovery options.

### Reputation effect

- Early GM cancellation: no negative public reputation effect by default.
- Repeated verified late GM cancellations may affect completion/reliability aggregates.
- One emergency cancellation does not create a public caution label.
- GM no-show is tracked separately from a cancellation with notice.

## Venue cancellation

A Venue may cancel when it cannot honor a table reservation.

When a Venue cancels:

1. session is no longer Confirmed at that venue;
2. GM and Players are notified immediately;
3. Player and GM reliability is unaffected;
4. system should attempt another compatible venue before cancelling the game entirely when feasible;
5. future recurring reservations remain separate unless explicitly withdrawn.

Repeated verified venue failures to honor confirmed reservations may appear in venue reliability aggregates after sample thresholds.

## Series vs session

Recurring campaigns must distinguish:

- **Cancel this session only**
- **Cancel selected future sessions**
- **Leave/cancel the entire series**

Never infer that cancelling one session means cancelling the whole campaign.

## Recovery priority

After a Player cancellation:

1. promote/offer seat to waitlist;
2. notify compatible demand signals if needed;
3. recalculate minimum Player threshold;
4. keep Confirmed if threshold still holds;
5. return to Forming if threshold is lost.

After a GM cancellation:

1. notify everyone;
2. optionally offer reschedule;
3. future sessions remain intact;
4. do not silently substitute another GM without Player/venue awareness.

After a Venue cancellation:

1. search compatible venue capacity;
2. request GM approval for meaningful location/time changes;
3. notify Players before moving the table;
4. cancel only when recovery is not feasible.

## Fairness safeguards

- Cancellation reasons are private by default.
- Users are not required to disclose medical or sensitive personal details.
- Cancellation metrics must distinguish responsible notice from no-show behavior.
- Platform-caused, GM-caused, or Venue-caused cancellations do not count against affected Players.
- Reputation is derived from verified patterns, not isolated life events.

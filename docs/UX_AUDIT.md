# Dinner, Dice & Dragons — UX / Accessibility Audit

## Purpose

This is the living audit for whether a first-time Player, Game Master, or Venue can understand the prototype, complete the intended flow, and recover from errors without outside explanation.

Last major pass: 2026-08-09.

## Audit rule

A feature is not considered usable merely because it is visible. The user must understand what it does, be able to operate it with keyboard/touch, receive clear success/error feedback, and have an obvious next step.

## Homepage / discovery

- [x] Value proposition explains real-world local tabletop discovery.
- [x] Browse does not require signup.
- [x] Primary Player and GM paths are visible.
- [x] Venue path is visible.
- [x] ZIP + travel-radius filtering is exposed in the discovery flow.
- [x] ZIP privacy is explained next to the control.
- [x] Matching status is announced with an ARIA live region.
- [x] No-match state explains how to recover.
- [x] Game cards include Details, Pass, and Interested controls.
- [x] Details are available before asking for interest.
- [x] Swipe-like choices have explicit keyboard-accessible buttons.
- [x] Cards expose joining method, duration, table culture, GM trust signal, and venue/accessibility note.
- [ ] Add dedicated game-detail URLs for SEO and sharing.
- [ ] Add system/date/play-style filters.
- [ ] Add Map and Calendar discovery views.

## Player onboarding

- [x] Player role is explained before the form.
- [x] Required profile fields are kept short.
- [x] ZIP is used instead of requiring an exact home address.
- [x] Travel radius is collected during onboarding.
- [x] Code of Conduct requires affirmative acknowledgement.
- [x] Browser validation is used for required fields/email.
- [x] Five-digit ZIP validation is explicit.
- [x] Prototype submission gives a visible success/error state instead of reloading silently.
- [x] Prototype data remains local to the browser and this limitation is stated.
- [ ] Production authentication/account creation.
- [ ] Production preference editing.

## Game Master onboarding

- [x] GM role is explained separately from Player role.
- [x] GM ZIP + travel radius are collected.
- [x] Systems run, experience, style, and availability are collected without a giant form.
- [x] Code of Conduct acknowledgement is required.
- [x] Prototype success/error feedback works through the shared form module.
- [ ] Nearby venue discovery using GM travel radius.
- [ ] Real event creation wizard.
- [ ] GM verification/trust workflow.

## Venue onboarding

- [x] Venue business value is explained before signup.
- [x] Venue responsibilities are explicit and intentionally lightweight.
- [x] Public street address + ZIP are collected for future matching.
- [x] Availability and table capacity are required.
- [x] Purchase policy and accessibility information are supported.
- [x] Venue confirms it is a public/community location and accepts the Code of Conduct.
- [x] Prototype submission provides visible confirmation.
- [ ] Real business verification.
- [ ] Venue manager authentication.
- [ ] Venue availability calendar.

## Accessibility

- [x] Skip links are present.
- [x] Semantic main/navigation structure is present.
- [x] Visible keyboard focus is defined.
- [x] Location controls use programmatic labels.
- [x] Forms use associated implicit labels and native validation semantics.
- [x] Status updates use live regions.
- [x] Important states use text, not color alone.
- [x] Reduced-motion preference is honored.
- [x] Mobile layout collapses multi-column content and game actions.
- [ ] Manual screen-reader pass with NVDA/VoiceOver.
- [ ] Formal contrast audit with automated tooling.
- [ ] Full WCAG 2.2 AA audit before production release.

## Trust / safety

- [x] Code of Conduct is visible from every major surface.
- [x] Public-venue-first strategy is explained.
- [x] Game details expose table-culture information before joining.
- [x] Public trust model avoids a single star score.
- [x] Reports are described as allegations requiring review.
- [ ] Functional private report form.
- [ ] Moderation queue/admin UI.
- [ ] Structured post-game feedback UI.
- [ ] Attendance/no-show UI.

## Technical quality

- [x] Static prototype deploys without a backend.
- [x] Core JS uses try/catch and meaningful console logging.
- [x] Large discovery/location behavior is split into focused modules.
- [x] Signup behavior is isolated in `forms.js`.
- [ ] Automated browser smoke tests.
- [ ] Automated broken-link check in GitHub Actions.
- [ ] Lighthouse/accessibility CI gate.

## Current critical gaps before claiming a complete interactive MVP

1. Real authentication and persistent accounts.
2. Dedicated event detail pages.
3. Real seat reservation/request-to-join workflow.
4. GM event-creation wizard.
5. GM nearby-venue discovery.
6. Venue verification.
7. Functional reporting/moderation workflow.
8. Map and calendar discovery.
9. Automated browser/accessibility regression tests.

These gaps are expected for the GitHub Pages validation prototype; they must not be represented as already implemented production functionality.

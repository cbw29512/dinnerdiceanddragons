# Dinner, Dice & Dragons — UX / Accessibility Audit

## Purpose

This is the living audit for whether a first-time Player, Game Master, or Venue can understand the prototype, complete the intended conceptual flow, and recover from errors without owner explanation.

Last major pass: 2026-08-10.

## Audit rule

A feature is not usable merely because it is visible. The user must understand what it does, be able to operate it by touch/keyboard, receive clear feedback, and know the next step.

## Product clarity

- [x] Homepage says the product turns local tabletop interest into actual game nights.
- [x] Three primary actions are explicit: Find My Table / Form a Table / Fill My Tables.
- [x] Site explains Player demand + GM availability + Venue capacity as the three matching signals.
- [x] Table Match is presented as the core differentiator.
- [x] Lifecycle language exists: Potential Match / Forming / Confirmed / Game Hub / Played.
- [x] People-swiping is no longer the primary discovery metaphor.
- [x] Explainable criteria are preferred over opaque AI-style match scores.
- [ ] Complete Player-demand aggregation is not implemented yet.
- [ ] Forming → Confirmed state transition is not functional yet.

## Homepage / discovery

- [x] Browse does not require signup.
- [x] ZIP + travel-radius filtering is visible.
- [x] ZIP privacy is explained.
- [x] Matching status uses ARIA live feedback.
- [x] Empty result state provides recovery guidance.
- [x] Cards show explicit lifecycle state.
- [x] Cards expose table details before commitment.
- [x] Swipe-era Pass/heart actions have been removed.
- [x] Discovery actions use View Table / Why It Fits / This Could Fit Me.
- [x] Dedicated game-detail URLs exist.
- [x] Detail pages show saved distance when available.
- [x] All sample game-page Player links now target the valid `#player` onboarding section.
- [ ] System/date/play-style filters.
- [ ] Calendar discovery.
- [ ] Map-style discovery concept.
- [ ] “This Could Fit Me” is prototype-only and does not persist shared demand yet.

## Player — Find My Table

- [x] Player role is explained before the form.
- [x] Form collects ZIP and travel radius rather than requiring a home address.
- [x] Availability is collected.
- [x] System-specific experience is repeatable.
- [x] Preferred format and willingness to learn are supported.
- [x] Table style/environment/accessibility notes are supported.
- [x] Code of Conduct acknowledgement is required.
- [x] Browser validation and visible success/error state exist.
- [x] Prototype storage limitation is disclosed.
- [ ] Structured recurring Player availability model.
- [ ] Shared Player demand aggregation.
- [ ] Real authentication/profile editing.

## Game Master — Form a Table

- [x] GM role is distinct from Player role.
- [x] Availability is treated as useful supply information.
- [x] ZIP/travel radius are collected.
- [x] System-specific GM experience is repeatable.
- [x] Preferred cadence, style, welcomed Players, and expectations are collected.
- [x] GM flows into Table Match rather than a generic venue directory.
- [x] Venue results use distance + full-session overlap.
- [x] GM can continue to the forming-game template.
- [ ] Matching results do not yet include real aggregate Player demand.
- [ ] GM verification/trust workflow is not functional.

## Venue — Fill My Tables

- [x] Venue value is explained before the form.
- [x] Page explicitly says staff do not run the RPG.
- [x] Venue supplies table inventory rather than vague willingness to host.
- [x] Address/ZIP, day/time, capacity, recurrence, purchase policy, and environment notes are collected.
- [x] Venue approval control is represented.
- [x] Business value includes expected headcount, actual visits, and recurring traffic.
- [x] Low-risk pilot framing exists.
- [ ] Multiple live recurring windows.
- [ ] Venue manager authentication/verification.
- [ ] Actual venue analytics are sample-only.

## Forming game

- [x] Game creation is explicitly framed as converting a viable match into a Forming table.
- [x] Selected venue/time is carried forward.
- [x] Recurrence and expected sessions are collected.
- [x] Expected full-table headcount is visible.
- [x] Player joining method, experience, age/environment, style, and boundaries are captured.
- [ ] Minimum Players required for confirmation is not yet an editable field.
- [ ] Venue approval is not a functional state change.
- [ ] Player commitment is not a functional shared registration.
- [ ] Waitlist/cancellation recovery is not implemented.

## Sample table detail pages

- [x] All three pages now identify themselves as Forming tables.
- [x] Navigation uses Find Tables / Find My Table / Table Match / Safety.
- [x] Old invalid `#player-signup` fragments were removed.
- [x] Table Fit and trust/environment are shown separately.
- [x] Pages explain what moves a table toward Confirmed.
- [ ] Sample standalone GM profile page.
- [ ] Sample standalone Venue profile page.

## Confirmed Game Hub

- [x] Hub is positioned after confirmation, not as a generic social feed.
- [x] GM / Player / Venue role switching exists.
- [x] Expected headcount and recurrence are visible.
- [x] GM ↔ Venue operations are separated from Player table discussion.
- [x] Venue announcements are logistics-focused.
- [x] Player → Venue structured questions exist.
- [x] Venue traffic proof is demonstrated with sample data.
- [ ] Messages are preview-only.
- [ ] Calendar synchronization is not live.
- [ ] Attendance/reputation calculations are not live.

## Trust / safety

- [x] Code of Conduct is accessible from major journeys.
- [x] Public-venue-first strategy is reinforced.
- [x] Safety/environment is described as part of Table Fit.
- [x] Self-described experience is separated from earned trust.
- [x] Role-specific trust signals avoid one generic star score.
- [x] Reports are private allegations requiring review.
- [ ] Functional private report form.
- [ ] Moderation queue/admin UI.
- [ ] Structured post-game feedback form.
- [ ] Functional attendance/no-show workflow.

## Accessibility

- [x] Skip links on major pages.
- [x] Semantic main/navigation landmarks.
- [x] Visible keyboard focus.
- [x] Programmatic labels on filters/forms.
- [x] Native controls used for primary interactions.
- [x] Status updates use live regions where applicable.
- [x] Important state labels use text, not color alone.
- [x] Reduced-motion preference supported.
- [x] Mobile layouts collapse major grids.
- [ ] Manual NVDA pass.
- [ ] Manual VoiceOver pass.
- [ ] Formal automated contrast audit.
- [ ] Full WCAG 2.2 AA review before production.

## Navigation / consistency

- [x] Core role pages now use new product vocabulary.
- [x] Sample game pages now use the new lifecycle vocabulary.
- [x] Broken Player fragment links discovered during this audit were fixed.
- [ ] Header navigation is not yet a single shared component, so wording can drift between static pages.
- [ ] CI currently checks files, but fragment/anchor validation should be added.
- [ ] README remains partly based on the earlier product model and should be refreshed when connector editing permits.

## Technical quality

- [x] Static prototype deploys without backend dependence.
- [x] Geographic matching is modularized.
- [x] Forms, experience builder, discovery, venue matching, game creation, and Game Hub use separate scripts.
- [x] Current CI validates HTML metadata/internal file links, browser JS syntax, and Apps Script syntax.
- [x] New product charter, positioning, roadmap, and Definition of Done agree on Table Match direction.
- [ ] Automated browser behavior smoke tests.
- [ ] Automated fragment-link validation.
- [ ] Lighthouse/accessibility CI gate.
- [ ] Shared navigation/layout component before production framework migration.

## Critical gaps before calling this a functional MVP

1. Structured Player availability and real Player-demand aggregation.
2. Three-sided Table Match using Player + GM + Venue signals.
3. Functional Potential Match → Forming → Confirmed lifecycle.
4. Shared seat registration/request/waitlist/cancellation recovery.
5. Authentication and role authorization.
6. Venue verification/approval state.
7. Calendar/reminders.
8. Functional Game Hub messaging.
9. Attendance + structured reputation.
10. Reporting/moderation workflow.
11. Browser/accessibility regression tests.

## Current assessment

The site is now a **coherent validation prototype** for a differentiated three-sided local tabletop matching product. It should not yet be described as a functioning multi-user community platform. The next product-risk milestone is real Player-demand aggregation feeding Table Match—not additional generic social features.

# Dinner, Dice & Dragons — UX / Accessibility Audit

## Purpose

This is the living audit for whether a first-time Player, Dungeon Master, or Venue can understand Dinner, Dice & Dragons, complete the intended workflow, recover from errors, and know what happens next without the owner explaining the site.

Last major pass: 2026-08-14.

## Audit rule

A feature is not usable merely because it is visible or wired to JavaScript. A person must understand what it does, be able to operate it by touch/keyboard, receive clear feedback, and know the next step.

Browser-local preview behavior and early-access shared behavior are intentionally distinguished from production-live behavior. Sample data must be labeled as sample data.

## Product clarity

- [x] Homepage leads with the outcome: play more D&D with less searching, scheduling, and organizing.
- [x] Player, DM, and Venue are presented as three equal entry points rather than one role being treated as primary.
- [x] Player promise is explicit: find a table that fits game, schedule, location, and table preferences.
- [x] DM promise is explicit: find interested Players and a public place that can host the game.
- [x] Venue promise is explicit: turn open table capacity into organized recurring game nights.
- [x] Homepage explains the core equation in plain language: Players + DM + Venue + compatible night = a game that can actually happen.
- [x] Table Match is explained as finding the overlap rather than as unexplained AI matching.
- [x] Lifecycle language is consistent: Forming → Confirmed → Game Hub → Played.
- [x] People-swiping is not used as the discovery model.
- [x] Match scores are accompanied by criterion-level explanations.

## Homepage / discovery

- [x] Browse does not require signup.
- [x] Three role doors are simultaneously visible on the homepage.
- [x] Homepage does not require a visitor to choose a dashboard mode before understanding the product.
- [x] Players, DMs, and Venues each have dedicated benefit sections.
- [x] `#discover` and `#how-it-works` remain valid for existing links.
- [x] Forming-game area shows useful sample tables when live listings are unavailable rather than a dead/disconnected-state card.
- [x] Sample forming games are clearly identified as samples.
- [x] ZIP and travel-radius filtering are visible on detailed matching surfaces.
- [x] ZIP privacy is explained.
- [x] Empty states provide a useful recovery action.
- [x] Dedicated sample game-detail URLs exist.
- [ ] Calendar discovery backed by production shared data.
- [ ] Map-style discovery.

## Player — Find My Table

- [x] Player value is explained before the form.
- [x] Form collects ZIP and travel radius rather than a home address.
- [x] Structured recurring availability windows are collected.
- [x] System-specific experience is repeatable.
- [x] Add/remove system controls work in a real Chromium test.
- [x] Add/remove availability controls work in a real Chromium test.
- [x] Preferred format and willingness to learn are supported.
- [x] Table style/environment/accessibility notes are supported.
- [x] Code of Conduct acknowledgement is required.
- [x] Browser validation and visible save/error state exist.
- [x] Disconnected mode truthfully says information is saved on the current device.
- [x] A saved Player profile can contribute normalized demand to local Table Match preview behavior.
- [x] Early-access seat request/cancel actions exist when the shared endpoint is configured.
- [ ] Production authentication and profile editing.

## Dungeon Master — Form My Table

- [x] DM role is distinct from Player role while allowing one person to use both.
- [x] Availability is treated as useful supply information.
- [x] ZIP/travel radius are collected.
- [x] System-specific DM experience is repeatable.
- [x] Preferred cadence, style, welcomed Players, and expectations are collected.
- [x] Saved DM game, first availability window, ZIP, and radius can prefill Table Match.
- [x] Venue results use DM distance and full-game-time overlap.
- [x] Player eligibility uses system, full-time overlap, and each Player’s venue travel range.
- [x] Sample Player interest is clearly labeled sample when live local interest is unavailable.
- [x] DM can continue from a viable match directly into Create My Forming Table.
- [x] The next-step commitment controls remain hidden until the game save succeeds.
- [x] Browser test proves the critical path: find Players + venue → create table → confirm venue/Players → unlock Game Hub.
- [ ] Production DM verification/trust workflow.

## Venue — Fill My Tables

- [x] Venue value is explained before the form.
- [x] Venue is treated as one equal side of the product rather than a passive directory listing.
- [x] Page explains that the DM coordinates the Players and remains the venue’s group contact.
- [x] Address/ZIP, day/time, capacity, recurrence, purchase policy, and environment notes are collected.
- [x] Venue approval control is represented.
- [x] Value language includes expected headcount, recurring traffic, policies, and one DM point of contact.
- [x] Table Match enforces venue per-table capacity as a hard constraint, including the DM’s seat.
- [x] Browser test proves a Venue can save an open table and continue into the Venue Game Hub view.
- [x] Early-access venue manager/booking actions exist when the shared endpoint is configured.
- [ ] Production venue manager authentication/verification.
- [ ] Production venue analytics.

## Table Match

- [x] Sample demand plus locally saved Player preferences can be aggregated in preview mode.
- [x] D&D 5e edition labels normalize to a compatible matching family while the edition is chosen during game creation.
- [x] System, day, full-game-time overlap, DM radius, Player radius, venue availability, and capacity are enforced before formation.
- [x] Venue capacity is a hard-fit rule rather than merely a score component.
- [x] Excess Player interest is separated from seats actually available.
- [x] Match breakdown uses understandable categories: Player fit, travel, schedule, and capacity.
- [x] Match selection carries venue/schedule/capacity/demand evidence into game creation.
- [x] Individual Player identities/contact details are not exposed in aggregate demand.
- [x] Sample demand is explicitly labeled as sample rather than live community demand.
- [ ] Experience/style/environment/accessibility Table Fit inputs are not yet calculated by the matching engine.
- [ ] Production-grade authenticated shared matching.

## Forming game

- [x] Game creation is framed as turning a viable match into a table Players can understand and join.
- [x] Selected venue/time carry forward automatically.
- [x] Matched Player count and venue Player capacity carry forward.
- [x] Venue capacity disables impossible maximum Player counts.
- [x] Recurrence and expected sessions are collected.
- [x] Expected full-table headcount is visible.
- [x] Minimum Players required for confirmation is editable.
- [x] Player joining method, experience, age/environment, style, and boundaries are captured.
- [x] Save success reveals a clear next action: Review Players & Confirm the Table.
- [x] Invalid/unsaved game state does not reveal that next-step shortcut.

## Recurring games

- [x] DM can check six future game nights before asking everyone to commit.
- [x] First game date is calculated from the selected weekday instead of using a stale hard-coded date.
- [x] Individual dates can be skipped, marked to move, or restored without changing the overall recurrence rule.
- [x] Exceptions carry into recurring-table creation.
- [x] DM can choose whole-campaign, individual-game-night, or core-party + open-seat commitment models.
- [x] Recurring commitment screen starts without fake named Players.
- [x] Manual sample request control is explicitly labeled as a preview control.
- [x] Browser test proves recurring schedule → recurring table → Player request approval → venue confirmation.

## Forming → Confirmed lifecycle

- [x] Venue approval changes readiness state.
- [x] Player commitment count changes readiness state.
- [x] Venue approval + minimum Player commitment derives Confirmed automatically.
- [x] Falling below minimum commitment returns the table to Forming.
- [x] DM cancellation overrides confirmation.
- [x] Waitlist/recovery behavior exists in preview/shared flows.
- [x] Cancellation timing is kept separate from misconduct.
- [x] Game Hub is locked until Confirmed.
- [x] Potential Player interest is explicitly separated from confirmed seats.
- [x] When the shared endpoint is not configured, technical/shared controls are hidden and the browser-only confirmation preview is clearly labeled.
- [x] When the shared endpoint is configured, role-specific DM/Venue/Player controls replace the local preview.
- [ ] Production authorization for lifecycle actions.

## Confirmed Game Hub

- [x] Hub is positioned after confirmation, not as a generic social feed.
- [x] DM / Player / Venue role switching exists.
- [x] Role buttons expose pressed state and controlled regions to assistive technology.
- [x] `?role=player|gm|venue` deep links open the appropriate Hub view.
- [x] DM view emphasizes headcount, party, game-night changes, and venue coordination.
- [x] Player view emphasizes seat, schedule, venue details, announcements, and table discussion.
- [x] Venue view emphasizes expected guests, recurring schedule, and one DM point of contact.
- [x] Message controls are explicitly labeled previews and say no real message was sent.
- [x] Browser test verifies role switching and message-preview behavior.
- [ ] Production persistent messaging.
- [ ] Live calendar synchronization.
- [ ] Production attendance/reputation calculations.

## Trust / safety

- [x] Code of Conduct is accessible from major journeys.
- [x] Public-venue-first strategy is reinforced.
- [x] Safety/environment is described as part of table fit.
- [x] Self-described experience is separated from earned trust.
- [x] Role-specific trust signals avoid one generic star score.
- [x] Reports are described as private allegations requiring review.
- [ ] Functional private report form.
- [ ] Moderation queue/admin UI.
- [ ] Structured post-game feedback form.
- [ ] Production attendance/no-show workflow.

## Accessibility / mobile

- [x] Skip links on major pages.
- [x] Semantic main/navigation landmarks.
- [x] Visible keyboard focus.
- [x] Programmatic labels on filters/forms.
- [x] Native controls used for primary interactions.
- [x] Game Hub role state is programmatically exposed.
- [x] Status updates use live regions where applicable.
- [x] Important state labels use text, not color alone.
- [x] Reduced-motion preference supported.
- [x] Mobile layouts collapse major grids.
- [x] Primary controls use touch-friendly minimum target sizes.
- [x] Chromium smoke test checks the homepage at 390 × 844 and asserts no horizontal overflow.
- [ ] Manual NVDA pass.
- [ ] Manual VoiceOver pass.
- [ ] Formal automated contrast/Lighthouse CI gate.
- [ ] Full WCAG 2.2 AA review before production.

## SEO / crawlability

- [x] Homepage has descriptive title and meta description.
- [x] Homepage has canonical, Open Graph, theme-color, and WebSite structured data.
- [x] Dashboard prototype is `noindex,follow` and canonicalized to the homepage.
- [x] Obsolete duplicate `index-old.html` was removed.
- [x] `sitemap.xml` lists focused public acquisition, trust, and sample-table surfaces.
- [x] Project-path `robots.txt` was intentionally removed because robots rules must live at the host root.
- [ ] Add a root-level robots file when the production/custom domain root is controlled.
- [ ] Review internal workflow pages for `noindex,follow` before broad public promotion.
- [ ] Add a social-share image before launch marketing.
- [ ] Validate and submit sitemap in Search Console when a production domain is chosen.

## Navigation / consistency

- [x] Homepage and core workflows use Player / DM / Venue language.
- [x] Core pages use consistent Home / Players / DMs / Venues / Safety navigation.
- [x] User-facing pages avoid exposing internal terms such as API, shared pilot, GameSeries, and session records in the normal path.
- [x] Sample game pages use the lifecycle vocabulary.
- [x] Broken Player fragment links discovered during earlier audits were fixed.
- [x] CI validates cross-page and same-page fragment targets.
- [x] CI rejects inert `href="#"` placeholder links.
- [ ] Header navigation is still duplicated across static pages rather than generated from one shared component.

## Technical quality

- [x] Static site deploys without backend dependence.
- [x] Geographic matching is modularized.
- [x] Saved-DM/demand-summary logic is separated from Table Match rendering.
- [x] Lifecycle state model, rendering, and interaction controller are separate modules.
- [x] Forms, experience builder, matching, recurring games, game creation, lifecycle, and Game Hub use separate scripts.
- [x] CI validates HTML metadata/internal links, fragments, placeholder links, button/controller wiring, browser JavaScript syntax, and Apps Script syntax.
- [x] Node unit tests cover core Table Match hard-fit and lifecycle status rules.
- [x] Chromium browser smoke tests run in CI using a local static server.
- [x] Seven browser tests currently cover homepage role entrances, Player onboarding controls/save, Venue onboarding/save, mobile overflow, DM match→create→confirm→Hub, recurring setup/commitments, and Game Hub role/message behavior.
- [ ] Lighthouse/accessibility CI gate.
- [ ] Shared navigation/layout component before production framework migration.

## Critical gaps before calling this a production multi-user MVP

1. Production authentication and role authorization.
2. Production-grade persistent Player, DM, Venue, booking, and seat state beyond the early-access pilot model.
3. Real venue verification and operational approval workflow.
4. Table Fit scoring for experience/style/environment/accessibility inputs.
5. Calendar synchronization and reminders.
6. Persistent Game Hub messaging.
7. Attendance and structured reputation persistence.
8. Reporting/moderation workflow.
9. Manual assistive-technology testing and automated accessibility/contrast gate.
10. Shared navigation/layout component or migration to the production application framework.

## Current assessment

Dinner, Dice & Dragons is now a **user-first connected validation site** for the core product loop. A new visitor sees three equal reasons to use the product; a Player can save what they want; a DM can match Player interest with a venue, form a table, collect commitments, and reach Confirmed; a Venue can save an open table and move into its game-night view; and recurring campaigns can carry one-date exceptions without breaking the schedule.

The critical local workflows are no longer trusted only because their buttons appear wired. CI now launches Chromium and clicks through seven representative end-to-end scenarios, including a direct workflow for each of the three audiences. The remaining product-risk milestone is turning the early-access/shared model into a secure authenticated multi-user service while preserving the privacy, explainability, and role clarity established by the current site.

# Dinner, Dice & Dragons — UX / Accessibility Audit

## Purpose

This is the living audit for whether a first-time Player, Game Master, or Venue can understand the prototype, complete the intended conceptual flow, and recover from errors without owner explanation.

Last major pass: 2026-08-14.

## Audit rule

A feature is not usable merely because it is visible. The user must understand what it does, be able to operate it by touch/keyboard, receive clear feedback, and know the next step.

Prototype-functional means the workflow can be demonstrated in the current browser. It does **not** mean the behavior is shared, authenticated, or production-live.

## Product clarity

- [x] Homepage says the product turns local tabletop interest into actual game nights.
- [x] Three primary actions are explicit: Find My Table / Form a Table / Fill My Tables.
- [x] Site explains Player demand + GM availability + Venue capacity as the three matching signals.
- [x] Table Match is presented as the core differentiator.
- [x] Lifecycle language exists: Potential Match / Forming / Confirmed / Game Hub / Played.
- [x] People-swiping is no longer the primary discovery metaphor.
- [x] Match scores are accompanied by criterion-level explanations rather than shown as unexplained AI percentages.
- [x] Prototype Player-demand aggregation combines seeded demand with a Player signal saved in the current browser.
- [x] Prototype Forming → Confirmed state transition is functional in browser-local lifecycle state.
- [ ] Shared multi-user demand aggregation and lifecycle persistence are not implemented.

## Homepage / discovery

- [x] Browse does not require signup.
- [x] Dashboard gives Player / GM / Venue a clear first action.
- [x] The `Viewing as` control is a native select and stays synchronized with the role buttons.
- [x] Role-specific dashboard links carry the selected role into the Game Hub.
- [x] `#discover` and `#how-it-works` anchors remain valid for links from existing pages.
- [x] ZIP + travel-radius filtering is visible on the detailed discovery surfaces.
- [x] ZIP privacy is explained.
- [x] Matching status uses ARIA live feedback.
- [x] Empty result state provides recovery guidance.
- [x] Cards show explicit lifecycle state.
- [x] Cards expose table details before commitment.
- [x] Swipe-era Pass/heart actions have been removed.
- [x] Discovery actions use View Table / Why It Fits / This Could Fit Me.
- [x] Dedicated game-detail URLs exist.
- [x] Detail pages show saved distance when available.
- [x] All sample game-page Player links target the valid `#player` onboarding section.
- [ ] System/date/play-style filters on the unified dashboard itself.
- [ ] Calendar discovery backed by shared data.
- [ ] Map-style discovery concept.
- [ ] “This Could Fit Me” is prototype-only and does not create a shared seat request yet.

## Player — Find My Table

- [x] Player role is explained before the form.
- [x] Form collects ZIP and travel radius rather than requiring a home address.
- [x] Structured recurring availability windows are collected.
- [x] System-specific experience is repeatable.
- [x] Preferred format and willingness to learn are supported.
- [x] Table style/environment/accessibility notes are supported.
- [x] Code of Conduct acknowledgement is required.
- [x] Browser validation and visible success/error state exist.
- [x] Prototype storage limitation is disclosed.
- [x] A saved Player profile contributes normalized demand signals to Table Match in the same browser.
- [ ] Shared multi-user Player demand aggregation.
- [ ] Real authentication/profile editing.

## Game Master — Form a Table

- [x] GM role is distinct from Player role.
- [x] Availability is treated as useful supply information.
- [x] ZIP/travel radius are collected.
- [x] System-specific GM experience is repeatable.
- [x] Preferred cadence, style, welcomed Players, and expectations are collected.
- [x] GM flows into Table Match rather than a generic venue directory.
- [x] Saved GM system, first availability window, ZIP, and radius prefill Table Match and can auto-run the first match query.
- [x] Venue results use GM distance + full-session overlap.
- [x] Player eligibility uses system, full-session availability, and each Player’s own venue travel radius.
- [x] Matching results include aggregated prototype Player demand.
- [x] GM can continue from a viable match to the Forming table template.
- [ ] GM verification/trust workflow is not functional.

## Venue — Fill My Tables

- [x] Venue value is explained before the form.
- [x] Page explicitly says staff do not run the RPG.
- [x] Venue supplies table inventory rather than vague willingness to host.
- [x] Address/ZIP, day/time, capacity, recurrence, purchase policy, and environment notes are collected.
- [x] Venue approval control is represented.
- [x] Business value includes expected headcount, actual visits, and recurring traffic.
- [x] Low-risk pilot framing exists.
- [x] Table Match enforces per-table venue capacity as a hard constraint, including the GM’s seat.
- [ ] Multiple shared/live recurring windows.
- [ ] Venue manager authentication/verification.
- [ ] Actual venue analytics are sample-only.

## Table Match

- [x] Seeded Player demand and a locally saved Player signal can be aggregated.
- [x] D&D 5e edition labels normalize to a compatible D&D 5e matching family while edition is selected later when forming the game.
- [x] System, day, full-session time overlap, GM radius, Player radius, venue availability, and capacity are enforced before formation.
- [x] Venue capacity is a hard-fit rule rather than merely a score component.
- [x] Excess Player demand is shown separately from seats actually available.
- [x] Match breakdown exposes Player demand, GM distance, schedule, and capacity components.
- [x] Match selection carries structured venue/schedule/capacity/demand evidence into Forming.
- [x] Player identities/contact details are not exposed in the demand snapshot.
- [x] Demand snapshot explicitly states that seeded data is prototype data, not live community demand.
- [ ] Experience/style/environment/accessibility Table Fit inputs are not yet calculated by the matching engine.
- [ ] Shared database-backed Player + GM + Venue matching.

## Forming game

- [x] Game creation is explicitly framed as converting a viable match into a Forming table.
- [x] Selected venue/time is carried forward.
- [x] Matched Player-demand count and venue Player capacity are carried forward.
- [x] Venue capacity disables impossible maximum Player counts.
- [x] Recurrence and expected sessions are collected.
- [x] Expected full-table headcount is visible.
- [x] Minimum Players required for confirmation is editable.
- [x] Player joining method, experience, age/environment, style, and boundaries are captured.
- [x] Saving seeds browser-local lifecycle state with match evidence.
- [x] Next step routes through commitment/confirmation management rather than directly into the Game Hub.
- [ ] Shared Player registration/request persistence.

## Forming → Confirmed lifecycle

- [x] Venue approval is a functional browser-local state change.
- [x] Player commitment count is a functional browser-local state change.
- [x] Venue approval + minimum Player commitment derives Confirmed automatically.
- [x] Falling below minimum commitment returns the table to Forming.
- [x] GM cancellation moves the session to Cancelled.
- [x] Waitlist and automatic promotion recovery are simulated.
- [x] Cancellation timing classification is simulated separately from misconduct.
- [x] Game Hub action is locked until Confirmed.
- [x] Match demand is explicitly separated from actual Player commitment.
- [x] Page states that approvals/commitments are local prototype simulation and notify nobody.
- [ ] Shared seat registration/request/waitlist/cancellation recovery across real users.
- [ ] Real venue approval workflow.

## Sample table detail pages

- [x] All three pages identify themselves as Forming tables.
- [x] Navigation uses Find Tables / Find My Table / Table Match / Safety.
- [x] Old invalid `#player-signup` fragments were removed.
- [x] Table Fit and trust/environment are shown separately.
- [x] Pages explain what moves a table toward Confirmed.
- [ ] Sample standalone GM profile page.
- [ ] Sample standalone Venue profile page.

## Confirmed Game Hub

- [x] Hub is positioned after confirmation, not as a generic social feed.
- [x] GM / Player / Venue role switching exists.
- [x] Role buttons expose pressed state and controlled regions to assistive technology.
- [x] `?role=player|gm|venue` deep links open the appropriate Hub view.
- [x] Expected headcount and recurrence are visible.
- [x] GM ↔ Venue operations are separated from Player table discussion.
- [x] Venue announcements are logistics-focused.
- [x] Player → Venue structured questions exist.
- [x] Required message fields are identified programmatically.
- [x] Prototype messaging says a preview was added instead of falsely implying persistence.
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
- [ ] Functional shared attendance/no-show workflow.

## Accessibility

- [x] Skip links on major pages.
- [x] Semantic main/navigation landmarks.
- [x] Visible keyboard focus.
- [x] Programmatic labels on filters/forms.
- [x] Native controls used for primary interactions.
- [x] Dashboard role selection works with a native select plus pressed-state buttons.
- [x] Game Hub role state is programmatically exposed.
- [x] Status updates use live regions where applicable.
- [x] Important state labels use text, not color alone.
- [x] Reduced-motion preference supported.
- [x] Mobile layouts collapse major grids.
- [x] Dashboard primary controls use touch-friendly minimum target sizes.
- [ ] Manual NVDA pass.
- [ ] Manual VoiceOver pass.
- [ ] Formal automated contrast audit.
- [ ] Full WCAG 2.2 AA review before production.

## SEO / crawlability

- [x] Homepage has a descriptive title and meta description.
- [x] Homepage has canonical, Open Graph, theme-color, and WebSite structured data.
- [x] Dashboard prototype is `noindex,follow` and canonicalized to the homepage.
- [x] Obsolete duplicate `index-old.html` was removed.
- [x] `sitemap.xml` lists the focused public acquisition, trust, and sample-table surfaces.
- [x] Project-path `robots.txt` was intentionally removed because robots rules must live at the host root, not `/dinnerdiceanddragons/robots.txt`.
- [ ] Add a root-level robots file when the production/custom domain root is controlled, and advertise the sitemap there.
- [ ] Review whether remaining internal workflow prototypes should receive `noindex,follow` before broader public promotion.
- [ ] Add a social-share image before launch marketing.
- [ ] Validate and submit the sitemap in Search Console when a production domain is chosen.

## Navigation / consistency

- [x] Core role pages use the new product vocabulary.
- [x] Sample game pages use the new lifecycle vocabulary.
- [x] Broken Player fragment links discovered during earlier audits were fixed.
- [x] Stale `reputation.html → index.html#demand` navigation was fixed.
- [x] CI validates cross-page and same-page fragment targets.
- [x] CI rejects inert `href="#"` placeholder links.
- [x] README reflects the three-sided Table Match product direction.
- [ ] Header navigation is not yet a single shared component, so wording can drift between static pages.

## Technical quality

- [x] Static prototype deploys without backend dependence.
- [x] Geographic matching is modularized.
- [x] Saved-GM/demand-summary logic is separated from Table Match rendering.
- [x] Lifecycle state model, lifecycle rendering, and lifecycle interaction controller are separate modules.
- [x] Forms, experience builder, discovery, venue matching, game creation, dashboard, and Game Hub use separate scripts.
- [x] CI validates HTML metadata/internal links, fragment targets, placeholder links, browser JS syntax, and Apps Script syntax.
- [x] Zero-dependency Node unit tests cover core Table Match hard-fit and lifecycle status rules.
- [x] New product charter, positioning, roadmap, and Definition of Done agree on Table Match direction.
- [ ] Automated browser behavior smoke tests.
- [ ] Lighthouse/accessibility CI gate.
- [ ] Shared navigation/layout component before production framework migration.

## Critical gaps before calling this a functional multi-user MVP

1. Shared persistent Player, GM, and Venue signals rather than seeded/browser-local records.
2. Shared seat request/approval/waitlist/cancellation transactions.
3. Authentication and role authorization.
4. Real venue verification and approval workflow.
5. Table Fit scoring for experience/style/environment/accessibility inputs.
6. Calendar/reminders.
7. Functional Game Hub messaging.
8. Attendance + structured reputation persistence.
9. Reporting/moderation workflow.
10. Browser/accessibility regression tests.

## Current assessment

The site is now a **connected validation prototype** for the core product loop: a Player signal can contribute to demand, a saved GM signal can feed Table Match, venue capacity is enforced, a viable match can become a Forming table, commitments can move it to Confirmed, and confirmation unlocks the Game Hub. Those interactions are deliberately browser-local and clearly labeled as prototype behavior.

The next product-risk milestone is no longer proving that the screens can connect conceptually. It is proving that the same workflow works with **shared multi-user state** for Player demand, GM supply, Venue capacity, seat commitments, and venue approval without losing the privacy and explainability rules established here.

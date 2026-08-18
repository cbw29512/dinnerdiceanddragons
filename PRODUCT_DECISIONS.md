# Dinner, Dice & Dragons — Product Decisions

This file records binding product decisions that refine the canonical `PRODUCT_VISION.md`. If a later implementation conflicts with one of these decisions, the implementation should be changed unless the decision is intentionally revisited.

## Decision 001 — Payments Come After Traction

**Status:** Accepted  
**Date:** 2026-08-18

Dinner, Dice & Dragons will **not build or require payments in V1**.

The first product goal is to prove that the platform can reliably turn local Player demand + GM supply + Venue capacity into completed, recurring real-world tabletop sessions.

### Before payments, prove traction through:

- completed tabletop sessions formed through the platform
- table formation completion rate
- seat fill rate
- attendance rate
- repeat-table rate
- campaign conversion / recurring-session rate
- venue repeat-host rate
- meaningful local density in the initial Florence, South Carolina market

### Explicitly deferred until after traction:

- paid table checkout
- GM payouts
- platform transaction fees
- subscriptions
- venue billing
- ticketing fees
- payment-provider integration
- refunds / disputes tied to monetary transactions
- tax / payout infrastructure

### V1 implication

Any references in the product vision to free-vs-paid preferences, paid GMs, transaction fees, premium tools, ticketing, or other monetization are **future-facing only** and must not expand the V1 scope.

V1 should optimize for liquidity, trust, successful table formation, attendance, repeat play, and measurable venue value—not revenue extraction.

### Gate for revisiting payments

Payments should only move onto the active roadmap once Dinner, Dice & Dragons has demonstrated repeatable table formation and repeat usage in the launch market. The exact traction threshold can be defined later from real product data rather than guessed in advance.

## Guiding Principle

> **First make tables happen. Then monetize what users already value.**

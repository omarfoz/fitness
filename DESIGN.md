# Fitness Tracker — product and design decisions

**Design iteration:** 2026-11-15 (mobile-first dashboard redesign)
**Reference:** [MyFitnessPal Redesign Concept, Kevin Bhagat for Heyo](https://dribbble.com/shots/18349515-MyFitnessPal-Redesign-Concept)

## The problem to solve

The original Fitness dashboard looked attractive but made the user scroll through a large challenge banner, multiple equal-weight statistic cards and a long form before reaching the activity they wanted to perform. On iPhone, the daily check-in required substantial scrolling. A reference redesign on Dribbble argues for bringing food/calorie tracking back to the center of a fitness app. That is an **information-architecture insight**, not a component to copy.

## Context and design constraints

- User wants a long-term weight-loss routine, with five regular days and two flexible days each week.
- Regular foods include shawarma, burgers, pizza and rice. Food estimates are **rough**; precise weighing and rigid nutritional targets are intentionally out of scope.
- Step goal: 10,000 per day. Fasting, coffee and one-meal habit are optional daily entries.
- Weigh-ins are **not required**.
- The tracker uses GitHub Pages and Supabase Auth, with private records and read-only sharing to verified users.
- Remain a standalone subdomain; do not copy the personal website's content or navbar.
- Keep the original **Liquid Glass** materials and blue highlights from oalfawzan.sa; use original SVG icons.
- All updates go directly to `main`.

## Decision: prioritize the top of the mobile screen

1. **Calorie estimate first:** An original circular-progress visual shows how many *estimated* calories were logged relative to a broad indicative range. It never invents macros or asserts exact remaining calories.
2. **Movement second:** A large step count with a lightweight progress bar makes the daily 10K goal legible at a glance.
3. **Fasting and consistency as secondary metrics:** Short summaries eliminate four equally dominant cards.
4. **Challenge progress as a thin strip:** A 30-day challenge should not dominate an everyday-use dashboard.
5. **Primary action near the estimate:** "Log a meal" navigates to the existing editable daily form; no duplicate logging interface or disconnected fake action.
6. **Bottom navigation on mobile:** Today, Log, History and Share are real in-page destinations, with the Share option hidden when viewing someone else's data.
7. **Preserve privacy:** Existing email verification, own-data permissions, restricted shared summaries, and revocation remain unchanged.
8. **Accessibility and iOS behavior:** Real buttons; SVG symbols; labelled progress; touch-sized tabs; safe-area padding; theme support; reduced-motion treatment.

## What we deliberately did not add

- Macro pie charts or protein/carbohydrate/fat statistics: not recorded by this application's database, so displaying them would fabricate information.
- Barcode or food-search features: would require reliable source data, external providers and potentially ongoing costs.
- "Calories remaining" as an exact number: inappropriate for an approximate-tracking workflow and unverified body-weight estimate.
- A redesigned Supabase schema: this is an interface iteration, not a data migration.
- An imitation or copy of Dribbble assets: this UI is original and uses the reference only for prioritization and layout direction.

## Acceptance checklist

- [x] Main responsive dashboard, edited in `main`.
- [x] Original SVG icons, no emoji icon set.
- [x] All original ID references preserved in `app.js`.
- [x] Calorie estimate and range dynamically update with selected day and flex status.
- [x] Steps, fasting and consistency dynamically update with saved data.
- [x] Mobile bottom navigation jumps to existing sections.
- [x] Shared-progress view remains read-only.
- [x] Dark and light mode styles; keyboard focus, colour tokens and safe area considered.
- [x] Static checks: JS syntax, DOM references, CSS braces, source files, and duplicated IDs.
- [ ] Browser QA: test on a real iPhone after GitHub Pages deployment.
- [ ] End-to-end QA: log an entry, switch dates, test viewer mode, and confirm persistence.

## Next decisions to revisit after use

Observe whether the calorie-focused card is genuinely helpful and whether the diary fields can be reduced further without losing important detail. Avoid adding goals or analytics that increase pressure without improving adherence.

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


## Mobile UI and UX follow-up: 15 Nov 2026

### UI diagnosis from an iPhone screenshot
- Two half-width number fields displayed uneven label wrapping and an extra explanation under just the calorie field, creating visibly mismatched heights.
- Duplicate "daily check-in" introduction above the actual logging card increased scroll cost without adding meaning.
- A 202-food picker required scrolling to its selected-items section to verify what had been added.
- Fasting/coffee labels, long explanations, and custom-food fields competed for narrow widths.

### Corrected interface
- Steps and calories are now equivalent compact metric input cards. At 1000px and below they stack as matching horizontal rows, with the value on the right and a short explanation on the left. On wider screens they align as equal-height tiles.
- Calorie estimation feedback is now a shared row *below* both metric tiles, so it can never stretch only one side.
- Removed the duplicate section heading and moved the Log navigation anchor to the actual form card.
- The food catalog has concise copy, clearer search labeling, accessible 44px controls, and an immediate selected-food count / estimated total beside search results. The Review foods action jumps to the editable list.
- Fasting/coffee labels and mobile serving/calorie editing have consistent spacing and minimum widths.
- Maintained Liquid Glass appearance, dark/light modes, collapsible reference cards, food pagination, read-only sharing, calendar data and scroll-aware bottom navigation.
- Forced native `[hidden]` to remain hidden regardless of decorative display rules.

### UX behavior and test boundaries
- No backend schema changes; daily entry, editable food totals, and verified-email sharing persist as before.
- JavaScript syntax, duplicate IDs, DOM selectors, food-list addition and live calorie recalculation were checked through static checks and a simulated browser DOM.
- iPhone visual QA, large system-font settings, landscape rotation, keyboard focus and real Supabase save/reload still require device testing; do not treat simulated checks as an iOS browser test.


## Typography palette audit, 16 Nov 2026

This audit affects text colors only. The Liquid Glass backgrounds, cards, SVGs,
spacing, saved data, and mobile layout remain as designed.

### Hierarchy

| Role | Dark | Light |
|---|---|---|
| Main headings / primary text | `#F6F8FF` | `#17263F` |
| Supporting text | `#B9C8DD` | `#40536E` |
| Eyebrow / understated labels | `#A8BAD3` | `#4E6179` |
| Action blue | `#91C0FF` | `#0756B4` |
| Food / coral | `#FFB4A7` | `#963D34` |
| Steps / mint | `#8DE7C8` | `#126B4D` |
| Fasting / purple | `#D0BCFF` | `#6140A5` |
| Consistency / amber | `#F8D69B` | `#815014` |
| Log / pink | `#FFB3D3` | `#983C6B` |
| Sharing / cyan | `#98E1ED` | `#116777` |

**Design reasoning:** Neutral, near-white/navy ink for headings; lighter but
readable secondary text; colored ink only where it labels a distinct activity
or status. In light mode the same semantic accents become deeper, less saturated
ink rather than reusing dark-theme pastels. Status, calendar, food shortcuts,
and bottom navigation retain consistent color meaning.

**Contrast:** Checked combinations with 3 representative solid navy backgrounds
and 10 representative pale glass colors. Minimum calculated text-background
contrast was **6.10:1 for dark subdued text**, **5.31:1 for light subdued text**,
and **11.36:1 for dark / 12.69:1 for light primary text**. All chosen ink colors
tested at least 5.31:1 in these samples. This is a mathematical source-level
test, not a claim that every live pixel of a translucent backdrop passes WCAG;
device visual QA remains necessary.

**Implementation:** `type-palette.css` is the last external stylesheet.
Repaired a malformed `mobile-polish.css` link in `index.html` so both sheets
parse independently. No changes were made to the critical inline log-grid
hotfix or business logic.


## CSV steps import, 18 Nov 2026

A signed-in tracker owner can expand **Import steps from CSV** under the History
calendar, next to the existing CSV export. The importer runs entirely in the
browser, then writes *daily step totals only* using Supabase RLS. No CSV file,
per-minute timestamps, or raw health records are uploaded or retained. Shared
progress viewers cannot import.

- Accepts `Date,Time,Steps`, where each row is an incremental reading, and
  `entry_date,steps`, where each row is a daily total.
- Accepts dates like `2026.11.15 02:32:00` or `2026-11-15`. Groups all rows by
  the local calendar date written in the CSV without time-zone conversion.
- Shows days, samples, totals and add/replace/skip counts **before** saving.
- Skips dates with an existing step count by default, so reimporting the same
  CSV cannot double-count those steps.
- Owners may deliberately choose to replace *steps only*; existing meals,
  calories, fasting, coffee and notes are preserved. Replacement is confirmed
  against current database state before it is applied.
- On success the calendar and metrics reload. Invalid rows block the import.
- Native Apple Health ZIP/XML archives are not CSV, and are **not supported**.
  Use a CSV from Apple Shortcuts or another trusted step-exporting app.

Validation: JavaScript syntax and DOM references pass; CSV date formats,
quoted fields and rejection of invalid/future data pass; a simulated Supabase
flow verified that replacing steps keeps prior calorie and meal values and
that repeated imports skip unchanged values. iPhone visual and live-account
end-to-end import still require user-device verification.


### Historical steps CSV follow-up, 18 Nov 2026

The challenge starts on **15 Nov 2026**, but exported historical pedometer
samples often start much earlier. The original CSV importer rejected those rows,
and the tracker also filtered older dates from loading and disabled their
calendar cells. Both restrictions were removed from *history* without changing
the start of the 30-day challenge.

- CSV accepts pre-challenge dates, still rejects future/invalid dates.
- CSV aggregation now works row by row rather than storing all CSV rows.
  Limits: 20 MB, 300,000 samples, 5,000 unique dates per file.
- The database lookup for existing entries uses chunks of 120 dates to avoid
  oversized PostgREST URLs. Steps-only updates still preserve meals/calories.
- The tracker now fetches daily entries using date-key cursor pagination, so
  the previous 1,000-row cap cannot silently hide the older imported days.
- A native **Jump to month** picker allows browsing years of historical data
  on mobile; the minimum date is the first date saved to this tracker.
- The challenge retains its original start date, calendar days before that date
  are not treated as flexible days, and challenge check-in counts exclude
  imported pre-challenge history. All-time history statistics still include it.

Validated by parser tests (including 2016 dates and quoted CSVs), JavaScript
syntax, stylesheet structure, and checking all new DOM IDs and JS references.
Visual confirmation and first-hand import of the user's full CSV on their
device are still pending.


### November 2026: liquid-glass monthly story card

The `Create story` button on Today renders a fully local **1080 × 1920 PNG**
for Snapchat, retaining the chosen date and any saved historical data. It uses
the real tracker records, not a static AI-generated graphic.

- The composition borrows only the idea of a monthly streak heatmap from sports
  tracking products. Visual language is original Fitness Tracker navy liquid
  glass with blue glass edges, mint step values, coral calorie values, and warm
  orange highlights.
- Monday-first calendar, correct month length, correctly positioned days,
  supports months spanning 4–6 weeks and historical dates before the challenge.
- All logged days show the **recorded** steps and estimated kcal inside the
  corresponding tile; missing fields are shown as dashes, not invented zeros.
- Dates with at least **10,000 steps** receive a hand-drawn Canvas vector
  flame icon. This is not an emoji, external icon or copyrighted asset.
- Selected day displays its full step and estimated calorie numbers. The
  heading displays the challenge day when applicable, and a past-days strip
  shows the most recent earlier logged dates within that month.
- Streak, monthly goal-day count and best streak are calculated as of the
  chosen date; records from later dates do not leak into historical cards.
- Only the signed-in owner's own records can be shared; image generation,
  preview and download run locally in the browser.

Validation: parser/source syntax and mocked Canvas tests (including a 6-week
month and February 2024 leap year), date selection, 10K flames, and the full
recorded step/calorie values. Live visual QA in Safari/Samsung Internet remains
to be done on the user's devices.


### 20 Nov 2026: ember streak story redesign

The first story looked like an app dashboard shrunk into a photo: three stat
cards, ALL-CAPS labels, a legend, and 16–18px tile text that nobody could read
at story size. The redesign keeps every data rule above and changes the
hierarchy so the story reads in a few seconds.

- **Headline as a sentence.** The current 10K streak ("3 days in a row") in a
  large condensed display face replaces the three stat cards. A plain sentence
  under it gives the month's 10K days (as of the chosen day) and the longest
  streak.
- **Streak bars.** On one liquid-glass month sheet, consecutive 10K days merge
  into a continuous ember bar per week row. A bar that carries on into the
  next week, or follows a 10K day at the end of the previous month, keeps a
  square edge. Each 10K day still gets its own vector flame.
- **Readable tiles.** Day, compact steps and kcal are set 2–3× larger. Logged
  days below 10K are glass blue, missed days are faint outlines, and future
  days are just dim numbers.
- **Selected day.** Exact steps (mint) and kcal (coral). A missing value reads
  "No steps logged" / "Nothing logged on this day", never a dash or a zero.
- **Earlier days** in the month are one quiet row with no boxes. The legend and
  slogan were removed.
- **Type.** Big Shoulders Display (numerals and headline; condensed, so 5-digit
  step counts fit 7 columns) and DM Sans (text). They are loaded only for the
  canvas under private names, so the app UI's fonts don't change. If Google
  Fonts is unreachable within 2.5 s, the story falls back to system fonts.

Checked in a desktop browser with mock data: a 6-week month, a 4-week month,
a day with nothing logged, a pre-challenge day and the in-app dialog flow.
Real-device Safari and Snapchat checks are still pending.


### 21 Nov 2026: story and card formats

The share dialog now offers two images built from the same month card:

- **Story 9:16** (2160 × 3840, i.e. 9:16 at 2× for sharp zooming): the card is centred on the night-navy ground,
  with one ember ring behind it (a full circle, so no cut ends; same ember gradient as the 10K days) and empty edges. The brand sits under the
  card.
- **Card only** (2160 wide, transparent corners): just the card, for use as a
  sticker or a post.

The card follows a simple monthly streak-calendar layout: month, three stats
(current 10K streak, 10K days of elapsed days, best streak), and one circle per
day. 10K days are ember circles with the vector flame, logged days below 10K are
glass-blue with the shoe mark, and missed days are outlined numbers. A small
badge gives the recorded steps (compact). A weekly column on the right shows a
check for weeks with a 10K day and the current streak inside a flame on the
selected week. The previous data rules (no invented zeros, no leakage from later
dates) are unchanged.

Checked in desktop Chrome with mock data: a 5-week month, a 6-week month, a leap
February, an empty month and both formats. Real-device Safari still pending.


### 21 Nov 2026: ready for colleagues (declutter pass)

The tracker was built around one person's plan. Before sharing it with
colleagues, everything personal or repeated was removed:

- **30-day challenge removed.** The 10K streak is the challenge. Check-ins are
  allowed for the last 60 days (or any older day that already has data), not
  from a fixed 15 Nov 2026 start.
- **No calorie target.** The fixed 1,900–2,200 kcal reference range is gone;
  Today shows the logged estimate and how many foods were added.
- **Flexible days hidden.** Forced Friday, the weekly flex picker and "The
  plan" card are no longer shown. The `weekly_flex` table is untouched, so the
  feature can come back as an opt-in setting.
- **Today:** Calories, Steps, one fasting row, the streak card, and a one-line
  story prompt. Consistency and challenge cards removed.
- **Check-in:** page title once, story button removed, fasting, coffee,
  one-meal, food notes, waist and notes inside "More details", delete moved
  away from Save.
- **Calendar:** Monday-first (matches the story card), story picker and Flex
  legend removed, "One-meal days" replaced by best streak, plain-language CSV
  import.
- **Share:** shorter copy, numbered iPhone install steps, Android help folded.
- Sign-in no longer mentions Supabase; slogan not repeated in the footer.

Checked in desktop Chrome at iPhone width with a mocked Supabase session: all
four pages render with no console errors. Live account and iPhone checks pending.

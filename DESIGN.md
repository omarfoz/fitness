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


### 23 Nov 2026: weekly recap in landmarks

A "Your week in landmarks" card on Today opens three slides for last week
(Mon–Sun; falls back to this week so far): total steps as a landmark
comparison, best day and 10K days, and the streak. Each slide can be shared as
a 2160 × 3840 image. Steps become distance at about 0.75 m a step.

Landmarks are Riyadh, Thadiq and Al-Kharj only, with figures from public
sources: Wadi Hanifah trail 13.4 km (Sports Boulevard site), King Abdullah Road
~25 km (Saudipedia), Riyadh Metro Blue Line 38 km and full network 176 km,
King Fahd Road 49 km, Riyadh–Al-Kharj ~85 km and Riyadh–Thadiq ~125 km by road,
Sports Boulevard ~135 km, Kingdom Centre 302.3 m, King Abdulaziz Mosque
minarets in Al-Kharj ~83 m (Saudipedia), Al-Marqab Tower in Raghba ~30 m
(Saudipedia). Illustrations are original flat SVGs in the app palette.

**Update (23 Nov, later):** redrawn illustrations (round night-sky badges,
silhouettes close to the real landmarks) and a daily card on Today. The daily
card picks a landmark for today's steps (it changes every 2,500 steps), shows
the 10K gap and the streak at stake, then a bar to the next milestone (first
km, 10 Kingdom Centres, King Salman Park loop, Wadi Hanifah trail, Diriyah).
Copy is upbeat on purpose: the goal is to get people excited to walk.
Added figures: Riyadh Water Tower 61 m, Kingdom Centre Sky Bridge 65 m, Riyadh
TV Tower 170 m, PIF Tower 385 m, King Salman Park loop 7.2 km, central Riyadh to
Diriyah ~20 km (Saudipedia), city to King Khalid Airport ~35 km, Riyadh to the
Edge of the World ~100 km (sources say 100–120 km), Wadi Hanifah 120 km. The Al-Kharj
mosque minaret was dropped (its real shape is unverified); Al-Kharj and Thadiq
are shown as green road signs instead.


### 23 Nov 2026: Challenges page (monthly challenges + badges)

New `challenges.html` (5th tab, trophy icon) with two tabs:

- **Monthly challenges** (`challenges.js`): one challenge per month, defined
  in code (Nov: Road to Al-Kharj, Dec: Metro Month, Jan: Tuwaiq Trek, Feb:
  Diriyah Weekends, Mar: Kingdom Climb, Apr: Park Laps). Join with one tap;
  the whole month's steps count, even from before joining. Three levels,
  bronze/silver/gold: reaching bronze wins the month. No rankings. A team bar
  sums everyone who joined via `challenge_team_summary(month)` (aggregate
  only; owner chose to show it from the first participant). Finisher medals
  (`challenge-medals.js`) look deliberately unlike badges: Sadu neck ribbon,
  eight-pointed Najdi star, landmark embossed in the metal, name round the rim.
- **My badges** (`badges.js`): 17 round medallions with a Najdi parapet rim in
  five tiers (best day, streak, journey, special), computed from all saved
  history, so past achievements count. "Almost there" shows the three closest.
  On first visit one popup announces how many badges past steps already
  earned; after that each new badge gets its own popup (Today and Challenges
  pages), with Share as a 9:16 image.

Database: `supabase/migrations/20261123_monthly_challenges.sql` and
`20261123_challenge_team_total_always.sql` (table `challenge_participants`,
RLS own rows only).


### 24 Nov 2026: Ember on graphite

The owner chose "Ember on graphite" from a three-palette comparison (Claude
Design canvas, "Home page: current vs proposed"). Fitness apps lead with one
energy colour on near-black; navy read as banking.

- `ember-theme.css` loads last on every page: graphite page (#0E0F12), neutral
  glass cards, one ember accent (#FF5A1F / #FF7A3D / #FFB27A), cream text.
  The rainbow of per-card tints (mint steps, pink food, purple fasting, blue
  challenge) is gone; mint stays only for "saved" states. Light mode keeps
  its look with an ember accent (#C2410C for contrast).
- Today (`index.html` + `today-hero.js`): greeting and a live title
  ("10K done. On fire!" / "2,300 steps to 10K"), a 🔥 streak pill, a big steps
  ring with km / kcal / fasting under it, This week bars (Mon–Sun, dashed 10K
  line), the landmark card, a one-line challenge strip with the medal, and
  Week recap / Share story buttons. The old calories ring, steps card and
  streak card are gone (same data, new places).
- Generated art follows: landmark skies are a dusk gradient (graphite to
  ember), Metro and plane accents ember, story card / recap / badge share
  images on graphite with ember highlights. Badge tiers and medal metals are
  unchanged.

Light mode is "Ember on paper": warm off-white page (#F6F3EF), white cards,
dark warm text, the same single ember accent (#EA580C / #C2410C for text).
No green, pink, purple or blue left in either mode.

No emoji in the UI. Icons are inline SVG (`.ico-flame`, `.ico-medal` in
`ember-theme.css`); copy that used emoji now relies on the words alone.

### 24 Nov 2026: Smooth page changes in the Home Screen app

On iPhone (Home Screen app) text looked bigger for a moment on every page
change, then settled. Fixes:
- `-webkit-text-size-adjust: 100%` in an inline `<style id="critical">` at the
  top of every page, so Safari never runs its text inflation while the CSS
  files are still loading. The same block paints the page background
  (graphite / paper) before any CSS arrives.
- `@view-transition { navigation: auto; }` (Safari 18.2+): the old page stays
  until the new one is laid out, then a 0.18 s cross-fade. Header and bottom
  bar are pinned with `view-transition-name`, so they do not blink.
- Challenges added to the pages prefetched on touch.

### 24 Nov 2026: Always on the latest version

GitHub Pages lets browsers keep HTML for 10 minutes and the iPhone Home
Screen app keeps it longer, so after a deploy people saw old pages. Every page
now carries `<meta name="app-build">`; `page-loading.js` compares it with
`/version.json` (fetched with no-store) on open and when the app returns to
the foreground, and reloads once through `?_b=<build>` if they differ.
Run `tools/bump-build.sh` before each deploy.

### 24 Nov 2026: Ember layout for Check-in, Calendar, Challenges and Share

Following the Dribbble pattern (near-black + one orange, few big numbers,
clear hierarchy), the other pages now match Today. Code: `pages-ember.js`
(adds UI around app.js's existing IDs; app.js calls `FitnessPages.render`)
and `pages-ember.css`.
- All pages: an orange eyebrow (date / section) above a Today-sized title.
- Check-in: date as a pill; Steps is the hero (huge number, live bar to 10K,
  km, quick-add chips +1,000 / +2,500 / +5,000 / 10K); Calories as one row;
  Save check-in floats above the bottom bar.
- Calendar: "This month" card (total steps, 10K days, km, avg, best day and
  a bar per day with the 10K line); days are shaded by steps (heat) and 10K
  days are solid orange; calories left the cells (still on the day itself);
  all-time numbers as tiles.
- Challenges: three tiles (this month km, badges earned, all-time km).
- Share: icon headers; reminder toggles in orange.
- Removed the old inline "fitness-critical-log-layout" style block from every
  page; it forced the two-column Steps/Calories layout.

### 26 Nov 2026: 3D badges you can spin

The badge window (new badge popup, and tapping any badge in My badges) shows
the badge as a solid coin (`badge-3d.js`, pure CSS 3D + requestAnimationFrame):
- spins in when it opens (skipped with Reduce Motion);
- drag to turn it, with momentum; it slows and settles on a face;
- tap (or Enter / Space / arrow keys) to flip; the back shows the badge name,
  the date it was earned and the tier;
- 24 stacked discs make the edge; a light streak moves across the face as it
  turns; the floor shadow narrows when the coin is side-on.
`badges.js` gained `svg(..., { flat: true })` (no floor shadow) and exports `rim`.

### 26 Nov 2026: Feedback round (two ChatGPT reviews)

Both reviews agreed the daily task felt bigger than one number and Today
repeated the shortfall. Shipped:
- Quick step entry: Today's button is "Log steps" / "Update steps" and opens
  a bottom sheet (Today / Yesterday, prefilled total, live km, Save steps).
  `FitnessApp.saveSteps` upserts the steps column only, so food, fasting and
  notes saved earlier that day are kept. Errors keep the typed number; double
  taps save once. "Add food or notes" links to Check-in for the same day.
- Today celebrates distance ("You walked about 4.8 km today."); the shortfall
  is said once, inside the ring. The landmark card sits right under the ring
  and its line points to the next landmark, not to 10K. The streak pill hides
  at 0; food kcal and fasting appear only once entered; the km row hides when
  the title already says it.
- Weekly highlight inside This week: last week's (or this week so far) km,
  landmark art and comparison; tapping opens the recap. The separate Week
  recap button is hidden.
- Copy and numbers: Check-in "Enter your steps. Everything else is
  optional."; "Today's total steps"; the confusing orange 10K chip removed
  (chips sit under "Add to total"); "avg per logged day"; "est. km"; calendar
  cells round down (9,999 shows 9.9k); "1 day" singular; streak lines state
  facts ("You reached 10K 4 days in a row."); story card shows
  "10K days: X of Y logged" instead of X / days-elapsed; challenge copy says
  every walk counts and Bronze is the first medal.
Not done yet (need decisions/tables): office walks, walking-only sharing with
preview, reminders moved to settings, Sign out into an account menu.

### 26 Nov 2026: Settings page, Sign out moved

Feedback: Sign out took the top-right corner on every page, and reminders
were hidden inside Share.
- Header: a gear button (`#accountBtn`, shown when signed in) replaces the
  Sign out button and opens `/settings.html`.
- Settings (`data-page="settingsSection"`): Daily reminders (moved from Share,
  open by default, `notifications.js` now loads here), Appearance (light mode
  switch, mirrors the header toggle), Account (email + Sign out).
- Share is now only "Share your progress" (who can view). Sharing scope is
  unchanged on purpose (owner prefers the current behaviour).
Office walks and walking-only sharing were reviewed and declined.

### 26 Nov 2026: Speed pass

Measured with Lighthouse (mobile, simulated slow 4G) on a local copy served
with compression; the live site can't be reached from the build machine.
- Pages loaded 15-18 separate render-blocking CSS files. They are now combined
  into one file per page in `css/` (`app.css` for Check-in, Calendar, Share
  and Settings, which have identical styles; `today.css`; `challenges.css`),
  in the exact original order. Pixel comparison of all six pages in both
  themes before/after: identical. Sources are unchanged; edit them, then
  `tools/bump-build.sh` rebuilds the bundles (`tools/build-css.py`, list in
  `tools/css-bundles.json`).
- supabase-js is served from `/vendor/supabase-js-2.119.2.min.js` instead of
  the jsDelivr CDN: no extra connection to a second host, and the version no
  longer floats under `@2`.
- Result: first paint 1.4 s → 1.1 s, requests 29-40 → 21-28, scores 98-100.
Next option if needed: cache the app files on the phone (service worker) so
pages open without waiting on the network.

### 26 Nov 2026: Pages open from the phone (service worker cache)

`fitness-push-sw.js` (the existing reminders worker; one worker per site, so
caching lives in the same file) now also keeps the app's own files on the
phone. `page-loading.js` registers it on every page after load.
- Pages: served from the cache instantly and refreshed in the background.
  The build check in page-loading.js reloads with `?_b=<build>` after a
  deploy; those loads go to the network first, so updates still arrive.
- Versioned CSS/JS and images: cache first; one copy per file is kept (older
  `?v=` copies are deleted).
- Never cached: `/version.json`, the worker itself, and anything on another
  origin (Supabase API, i.e. all personal data).
- Install pre-caches all six pages and the files they link.
Measured on a local copy with slow 4G: first visit paints at ~1.5 s, later
pages at 0.1-0.2 s; pages open offline; a simulated deploy was picked up and
the old CSS copy removed. Change `CACHE` in the worker to wipe all copies.

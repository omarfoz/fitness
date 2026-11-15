# Fitness Tracker

A private, mobile-first wellness tracker hosted at **fitness.oalfawzan.sa** on GitHub Pages.

Built with HTML, CSS and JavaScript, with the Liquid Glass styling of oalfawzan.sa. It does not require a paid host, framework build, or server. Supabase handles authentication and per-user storage.

## What's included

- Email/password sign-in, account creation, password reset
- Daily steps, rough calorie estimates, meals, fasting hours, black coffee, optional waist measurements and notes
- **202 food options across 14 categories**, including burritos, tacos, shawarma, burgers, pizza, Saudi rice dishes, breakfast, salads, desserts, and drinks
- **Arabic and English food search**, per-serving calorie estimates, adjustable serving quantity and individual calorie values, and custom foods
- Daily calorie total automatically calculated from selected foods, with a manual override for more accurate restaurant or nutrition-label numbers
- Itemized selected foods saved privately to Supabase in `daily_entries.meal_items` and restored when you reopen any saved day
- One-meal checkbox to record the day's actual pattern (not a medical recommendation)
- Friday as the fixed flexible day, plus **one selectable extra flexible day per Sunday-to-Saturday week**
- Calendar of saved entries, 30-day progress, averages and CSV export
- Dark/light mode, responsive layouts and Add to Home Screen manifest
- Per-user PostgreSQL Row Level Security (RLS); no diet logs stored in the public repository or browser local storage
- No analytics scripts on the tracker
- **Private sharing by verified email**, with a dedicated viewer list, invitation message, and one-click access revocation
- **Read-only shared progress:** viewers can see steps, approximate calories, fasting, coffee and one-meal check-ins, plus weekly flex days; meal descriptions, notes and waist measurements stay private
- SVG-based checkbox and disclosure controls designed to avoid black native iPhone input rendering

## How to deploy

The files in this repository are ready to serve as a **static GitHub Pages site**. The `CNAME` file already specifies `fitness.oalfawzan.sa`.

1. Open **Repository Settings → Pages**. Under **Build and deployment**, select **Deploy from a branch**, choose **main** and **/(root)**, and save. Keep the custom domain as `fitness.oalfawzan.sa`.
2. At your domain DNS provider, add a CNAME record: **Host** `fitness` → **Target** `omarfoz.github.io` (use exactly this host, not a full URL). DNS can take time to propagate.
3. Once Pages shows the custom domain as verified/available, turn on **Enforce HTTPS**.
4. In Supabase **Authentication → URL Configuration**, set **Site URL** to `https://fitness.oalfawzan.sa/` and add the same URL to **Redirect URLs**. This is necessary for signup confirmation and password reset links.
5. In Supabase **Authentication → Providers → Email**, keep email/password enabled. Depending on your email provider's settings, confirmation emails may require additional setup or have free-tier limits.
6. Visit `https://fitness.oalfawzan.sa/`, create an account, verify it if confirmation is on, and sign in.

If you want to invite someone who does **not** already have an account, keep Supabase email sign-ups enabled while that person registers and verifies their email. If you disable new sign-ups, only existing verified accounts can accept invitations. Each user's data remains protected by RLS.

## Food library

1. Go to **Log → Find something you ate**.
2. Search in **English or Arabic** (e.g., `burrito`, `taco`, `شاورما`, or `رز`) or browse one of the **14 categories**. Tap **All** to browse the full 202-item library.
3. Tap any food to add it. Tap it again to increase its quantity, or type a precise quantity in increments of 0.5 servings.
4. Change **Kcal / serving** for that food if your restaurant or product label gives a better number.
5. The **daily calorie total** automatically follows your selected foods, unless you edit that total manually. Use **Use food total** to recalculate it from your list.
6. Use **Add a custom food** to log anything not listed, and write optional free-form notes.
7. Select **Save today's check-in**. The item list is stored in your private daily record and is editable later.

**Accuracy:** All catalog calorie numbers are ballpark examples for the serving shown, *not verified label values or nutrition prescriptions*. Recipe, restaurant, toppings, sauces, and portion size may significantly change the actual calories. The app allows you to replace estimates with restaurant nutrition facts or package labels when available. Food names and serving estimates are bundled in the static app; there is **no external nutrition API or additional subscription**.

The new `supabase/migrations/20261115_itemized_foods.sql` adds a JSONB array to the existing daily table without removing older records. Existing owner-only RLS policies protect itemized foods. The restricted viewer RPC intentionally does not expose individual food names or meal notes.

## Private, read-only progress sharing

1. Sign in to **your own** Fitness Tracker, then scroll to **Share your progress**.
2. Enter your chosen viewer's email and select **Allow read-only access**.
3. Select **Copy invitation message** and send it to the viewer through your preferred messaging app. **The app does not automatically email invitations.**
4. The viewer must create an account (if needed), **verify that same email address**, and sign in at `https://fitness.oalfawzan.sa/`. If already signed in, reloading the page claims the invitation.
5. The viewer chooses your tracker from the progress selector near the top of the dashboard. They can browse progress but cannot add, edit, or delete records.
6. To revoke access, choose **Remove** beside their email in **People with access**. After revocation, new data requests are denied.

Data boundaries: sharing is restricted to date, steps, estimated calories, fasting hours, one-meal status, black-coffee cups, and selected weekly flexible days. The app intentionally does **not** expose exact meal descriptions, private notes or waist measurements in the viewer RPCs. There is no public, unauthenticated share URL.

Security implementation is documented in `supabase/migrations/20261115_private_progress_sharing.sql`. Three `SECURITY DEFINER` RPCs are intentionally callable by logged-in users. Each verifies either the caller's confirmed email (to claim an invitation) or an active, owner-controlled share row (to read selected progress). This restricted design may produce an intentional Supabase advisory for authenticated SECURITY DEFINER functions. Review function changes carefully before deploying.

## Backend configuration and security

- `config.js` contains only the **public Supabase project URL and publishable key**; these are safe for the browser. **Never commit a service-role or secret key.**
- `supabase/migrations/20261115_initialize_fitness.sql` documents the original schema and RLS policies; `supabase/migrations/20261115_private_progress_sharing.sql` documents owner-controlled invitations and restricted view-only access.
- API requests use the current signed-in user's session. Standard tracking-table RLS restricts direct reads and writes to `auth.uid() = user_id`; signed-in invited viewers receive only selected summary fields via explicitly authorized RPCs.
- The repository and page HTML are public even though the tracking records require authentication. The app sends `noindex` metadata and `robots.txt` denies indexing, but these are not access controls.
- Data export is a local CSV download in your browser, not a cloud sharing service.
- Use at least a strong unique password. Consider enabling multi-factor authentication in Supabase if desired.
- Supabase free projects can be paused after prolonged inactivity. Review your project dashboard for availability and free-tier limits.

## Local preview

Serve the folder over HTTP rather than opening `index.html` as a file:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`. Add `http://localhost:8000/` to Supabase Auth Redirect URLs only for local confirmation/reset testing.

## Routine

The challenge starts **15 Nov 2026** and the first 30 days run to **14 Dec 2026**; entries remain available after the challenge. Week boundaries are **Sunday–Saturday**. The 10,000-step goal and one-meal preference are user-defined tracking targets, not personalized medical prescriptions. Calorie numbers entered are rough estimates. The tracker deliberately does not require a weigh-in.

If fasting causes faintness, dizziness, or difficulty meeting nutritional needs, adjust the plan and seek individualized advice.

## Costs

GitHub Pages and Supabase both offer free tiers that are appropriate for small personal trackers, subject to usage limits and provider terms. Existing domain renewal fees are separate.

# Fitness Tracker

A private, mobile-first wellness tracker hosted at **fitness.oalfawzan.sa** on GitHub Pages.

Built with HTML, CSS and JavaScript, with the Liquid Glass styling of oalfawzan.sa. It does not require a paid host, framework build, or server. Supabase handles authentication and per-user storage.

## What's included

- Email/password sign-in, account creation, password reset
- Daily steps, rough calorie estimates, meals, fasting hours, black coffee, optional waist measurements and notes
- One-meal checkbox to record the day's actual pattern (not a medical recommendation)
- Friday as the fixed flexible day, plus **one selectable extra flexible day per Sunday-to-Saturday week**
- Calendar of saved entries, 30-day progress, averages and CSV export
- Dark/light mode, responsive layouts and Add to Home Screen manifest
- Per-user PostgreSQL Row Level Security (RLS); no diet logs stored in the public repository or browser local storage
- No analytics scripts on the tracker

## How to deploy

The files in this repository are ready to serve as a **static GitHub Pages site**. The `CNAME` file already specifies `fitness.oalfawzan.sa`.

1. Open **Repository Settings → Pages**. Under **Build and deployment**, select **Deploy from a branch**, choose **main** and **/(root)**, and save. Keep the custom domain as `fitness.oalfawzan.sa`.
2. At your domain DNS provider, add a CNAME record: **Host** `fitness` → **Target** `omarfoz.github.io` (use exactly this host, not a full URL). DNS can take time to propagate.
3. Once Pages shows the custom domain as verified/available, turn on **Enforce HTTPS**.
4. In Supabase **Authentication → URL Configuration**, set **Site URL** to `https://fitness.oalfawzan.sa/` and add the same URL to **Redirect URLs**. This is necessary for signup confirmation and password reset links.
5. In Supabase **Authentication → Providers → Email**, keep email/password enabled. Depending on your email provider's settings, confirmation emails may require additional setup or have free-tier limits.
6. Visit `https://fitness.oalfawzan.sa/`, create an account, verify it if confirmation is on, and sign in.

For a single-owner tracker, create your account first, then **disable new user sign-ups** in Supabase authentication settings. This is optional, but prevents other people from registering. RLS already prevents users from reading each other's records.

## Backend configuration and security

- `config.js` contains only the **public Supabase project URL and publishable key**; these are safe for the browser. **Never commit a service-role or secret key.**
- `supabase/migrations/20261115_initialize_fitness.sql` documents the schema and per-user RLS policies that have already been applied to the connected project.
- API requests use the current signed-in user's session. All record reads and writes are restricted to `auth.uid() = user_id`.
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

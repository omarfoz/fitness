import { createClient } from "npm:@supabase/supabase-js@2.57.0";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const VAPID_PUBLIC = "BA5IlLyKxRM9-CJHMAx-jSWTNLr8ODrOx1dKW8xVS9MKNdqGBNydIvO_iKL6n5-rcgdvfMyvxJaDRTLw9cbdg_s";
const ORIGIN = "https://fitness.oalfawzan.sa";
const SLOTS: Record<string, string> = {
  "10:00": "Good morning! Start your day with a small step toward your goals.",
  "16:00": "Afternoon check-in: how many steps have you taken so far?",
  "21:00": "Your evening reminder: log today's food, calories and steps."
};
const json = (body: Record<string, unknown>, code = 200) =>
  new Response(JSON.stringify(body), { status: code, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "Access-Control-Allow-Origin": ORIGIN, "Vary": "Origin" } });

function sameSecret(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] || 0) ^ (y[i] || 0);
  return diff === 0;
}
function riyadhDate(): string {
  const items = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (t: string) => items.find((x) => x.type === t)?.value || "";
  return part("year") + "-" + part("month") + "-" + part("day");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": ORIGIN, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" } });
  if (req.method !== "POST" || req.headers.get("origin") && req.headers.get("origin") !== ORIGIN) return json({ error: "Not allowed" }, 405);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ error: "Server configuration unavailable" }, 503);
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const body = await req.json().catch(() => ({}));
    const test = body?.test === true;
    const slot = typeof body?.slot === "string" ? body.slot : "";
    if (!test && !Object.hasOwn(SLOTS, slot)) return json({ error: "Unsupported reminder time" }, 400);

    // Secrets are returned only to the service_role via a restricted RPC.
    const { data: keys, error: secretError } = await admin.rpc("fitness_push_sender_secrets");
    const secrets = Array.isArray(keys) ? keys[0] : null;
    if (secretError || !secrets?.vapid_private_key || !secrets?.cron_token) return json({ error: "Push keys unavailable" }, 503);

    let owners: string[] = [];
    if (test) {
      const authHeader = req.headers.get("authorization") || "";
      const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
      if (!jwt) return json({ error: "Sign in required" }, 401);
      const { data: identity, error: identityError } = await admin.auth.getUser(jwt);
      if (identityError || !identity?.user) return json({ error: "Invalid session" }, 401);
      owners = [identity.user.id];
    } else {
      const provided = req.headers.get("x-fitness-cron-secret") || "";
      if (!sameSecret(provided, secrets.cron_token)) return json({ error: "Unauthorized" }, 401);
      const { data: prefs, error: prefsError } = await admin.from("fitness_push_preferences")
        .select("user_id").eq("enabled", true).contains("reminder_times", [slot]).limit(500);
      if (prefsError) throw prefsError;
      owners = (prefs || []).map((row: { user_id: string }) => row.user_id);
    }
    webpush.setVapidDetails(ORIGIN, VAPID_PUBLIC, secrets.vapid_private_key);
    const today = riyadhDate();
    let success = 0, failed = 0, devices = 0;
    for (const userId of owners) {
      const { data: subscriptions, error: subsError } = await admin.from("fitness_push_subscriptions")
        .select("id,endpoint,p256dh,auth_secret").eq("user_id", userId).limit(20);
      if (subsError) { failed++; continue; }
      if (!subscriptions?.length) continue;
      if (!test) {
        // A claimed slot is not proof of successful delivery. A previous run
        // might have been interrupted by an HTTP timeout. Retry unfinished
        // slots and suppress only pushes accepted by a push provider.
        const runKey = { user_id: userId, reminder_date: today, reminder_time: slot };
        const { data: prior, error: readError } = await admin
          .from("fitness_push_delivery_runs").select("delivered_at")
          .eq("user_id", userId).eq("reminder_date", today)
          .eq("reminder_time", slot).maybeSingle();
        if (readError) { failed++; continue; }
        if (prior?.delivered_at) continue;
        if (!prior) {
          const { error: reserveError } = await admin.from("fitness_push_delivery_runs")
            .upsert(runKey, {
              onConflict: "user_id,reminder_date,reminder_time",
              ignoreDuplicates: true
            });
          if (reserveError) { failed++; continue; }
        }
      }
      const bodyText = test ? "Your Fitness Tracker notifications are working!" : SLOTS[slot];
      const payload = JSON.stringify({ title: "Fitness Tracker", body: bodyText, url: ORIGIN + "/", tag: "fitness-" + (test ? "test" : slot + "-" + today) });
      let delivered = 0;
      for (const sub of subscriptions) {
        devices++;
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_secret } }, payload, { TTL: 3600, timeout: 12000 });
          delivered++;
          success++;
        } catch (error) {
          failed++;
          const status = (error as { statusCode?: number })?.statusCode;
          if (status === 404 || status === 410) await admin.from("fitness_push_subscriptions").delete().eq("id", sub.id).eq("user_id", userId);
          else console.warn("Fitness push delivery failed with status", status || "unknown");
        }
      }
      if (!test && delivered > 0) {
        const { error: confirmError } = await admin.from("fitness_push_delivery_runs")
          .update({ delivered_at: new Date().toISOString() })
          .eq("user_id", userId).eq("reminder_date", today).eq("reminder_time", slot);
        if (confirmError) console.warn("Fitness push confirmation could not be recorded");
      }
      if (!test && delivered === 0) {
        // Allow a later controlled retry if all devices failed.
        await admin.from("fitness_push_delivery_runs").delete()
          .eq("user_id", userId).eq("reminder_date", today).eq("reminder_time", slot);
      }
    }
    // Count results only, never log subscription endpoints, keys or user IDs.
    console.info("Fitness push run complete", JSON.stringify({
      mode: test ? "test" : slot, recipients: owners.length, devices, success, failed
    }));
    return json({ ok: true, success, failed, devices, recipients: owners.length, test });
  } catch (error) {
    console.error("Fitness push function failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "Notification service error" }, 500);
  }
});

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

type WishlistRow = {
  id: string;
  title: string | null;
  user_id: string;
  event_date: string | null;
  privacy_level: "public" | "friends_only" | "private" | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  username: string | null;
};

type FollowerRow = {
  user_id: string;
  following_id: string;
  status: "accepted" | "pending" | null;
};

type ReminderRow = {
  wishlist_id: string;
  follower_id: string;
  event_date: string;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID");
const ONESIGNAL_REST_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY");
const CRON_SECRET = Deno.env.get("CRON_SECRET");

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function buildQuery(params: Record<string, string>) {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    q.set(key, value);
  }
  return q.toString();
}

async function sbGet<T>(table: string, params: Record<string, string>): Promise<T[]> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase service role env");
  }
  const url = `${SUPABASE_URL}/rest/v1/${table}?${buildQuery(params)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase query failed: ${table}: ${text}`);
  }

  return (await res.json()) as T[];
}

async function sbUpsert(table: string, payload: Record<string, unknown>) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase service role env");
  }
  const url = `${SUPABASE_URL}/rest/v1/${table}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase upsert failed: ${table}: ${text}`);
  }
}

function buildTargetDate() {
  const now = new Date();
  const base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  base.setUTCDate(base.getUTCDate() + 3);
  const startIso = base.toISOString();
  const end = new Date(base);
  end.setUTCDate(end.getUTCDate() + 1);
  const endIso = end.toISOString();
  const dateKey = startIso.slice(0, 10);
  return { startIso, endIso, dateKey };
}

async function sendPushToUser(userId: string, title: string, message: string, data?: Record<string, unknown>) {
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
    throw new Error("Missing OneSignal env");
  }

  const payload: Record<string, unknown> = {
    app_id: ONESIGNAL_APP_ID,
    include_aliases: { external_id: [userId] },
    target_channel: "push",
    headings: { en: title },
    contents: { en: message },
  };

  if (data && typeof data === "object") {
    payload.data = data;
  }

  const res = await fetch("https://onesignal.com/api/v1/notifications", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OneSignal error: ${text}`);
  }
}

function requireCronAuth(req: Request) {
  if (CRON_SECRET) {
    const secret = req.headers.get("x-cron-secret") || "";
    if (secret !== CRON_SECRET) {
      throw new Error("Unauthorized");
    }
    return;
  }

  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
  if (!token || token !== SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Unauthorized");
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    requireCronAuth(req);

    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const { startIso, endIso, dateKey } = buildTargetDate();

    const wishlists = await sbGet<WishlistRow>("wishlists", {
      select: "id,title,user_id,event_date,privacy_level",
      event_date: `gte.${startIso}`,
      event_date_end: `lt.${endIso}`,
      privacy_level: "in.(public,friends_only)",
    });

    if (wishlists.length === 0) {
      return jsonResponse({ ok: true, sent: 0, reason: "no_events" });
    }

    const ownerIds = Array.from(new Set(wishlists.map((w) => w.user_id)));
    const ownerProfiles = await sbGet<ProfileRow>("user_profiles", {
      select: "id,full_name,username",
      id: `in.(${ownerIds.join(",")})`,
    });
    const ownerMap = new Map(ownerProfiles.map((p) => [p.id, p]));

    const followerRows = await sbGet<FollowerRow>("followers", {
      select: "user_id,following_id,status",
      following_id: `in.(${ownerIds.join(",")})`,
      status: "eq.accepted",
    });

    const followersByOwner = new Map<string, string[]>();
    followerRows.forEach((row) => {
      if (!row.user_id || !row.following_id) return;
      if (!followersByOwner.has(row.following_id)) {
        followersByOwner.set(row.following_id, []);
      }
      followersByOwner.get(row.following_id)?.push(row.user_id);
    });

    const reminderRows = await sbGet<ReminderRow>("wishlist_event_reminders", {
      select: "wishlist_id,follower_id,event_date",
      event_date: `eq.${dateKey}`,
    });
    const reminderSet = new Set(reminderRows.map((r) => `${r.wishlist_id}:${r.follower_id}:${r.event_date}`));

    let sent = 0;

    for (const wishlist of wishlists) {
      const followerIds = followersByOwner.get(wishlist.user_id) || [];
      if (followerIds.length === 0) continue;

      const ownerProfile = ownerMap.get(wishlist.user_id);
      const ownerName = ownerProfile?.full_name || ownerProfile?.username || "Someone";
      const wishlistTitle = wishlist.title || "wishlist";

      for (const followerId of followerIds) {
        const reminderKey = `${wishlist.id}:${followerId}:${dateKey}`;
        if (reminderSet.has(reminderKey)) continue;

        const message = `Reminder: ${ownerName}'s ${wishlistTitle} is in 3 days.`;
        await sendPushToUser(followerId, "Wishly", message, {
          type: "event_reminder",
          wishlistId: wishlist.id,
          ownerId: wishlist.user_id,
        });

        await sbUpsert("wishlist_event_reminders", {
          wishlist_id: wishlist.id,
          follower_id: followerId,
          event_date: dateKey,
        });

        reminderSet.add(reminderKey);
        sent += 1;
      }
    }

    return jsonResponse({ ok: true, sent });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return jsonResponse({ error: message }, message === "Unauthorized" ? 401 : 500);
  }
});

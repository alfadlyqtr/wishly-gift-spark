import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

type PushDispatchBody =
  | { type: "follow_request"; targetUserId: string }
  | { type: "follow_accepted"; fromUserId: string }
  | { type: "claim_created"; itemId: string }
  | { type: "claim_decision"; reservationId: string; decision: "approved" | "declined" }
  | { type: "unclaim_requested"; reservationId: string }
  | { type: "unclaim_approved"; itemId: string; claimerId: string }
  | { type: "unclaim_declined"; reservationId: string }
  | { type: "message_sent"; threadId: string }
  | { type: "comment_added"; wishlistId: string };

type UserProfile = {
  full_name: string | null;
  username: string | null;
};

type UserProfilePush = {
  onesignal_player_id: string | null;
};

type PushDeviceRow = {
  onesignal_device_id: string;
};

type FollowerRow = {
  status: "pending" | "accepted";
};

type ReservationRow = {
  id: string;
  status: string | null;
  item_id: string;
  reserved_by_id: string;
};

type ItemOwnerRow = {
  title: string | null;
  wishlists?: { user_id: string } | null;
};

type MessageRow = {
  id: string;
  thread_id: string;
  user_id: string;
  content: string | null;
  attachment_type: string | null;
};

type ThreadParticipantRow = {
  user_id: string;
};

type WishlistRow = {
  user_id: string;
  title: string | null;
};

const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID");
const ONESIGNAL_REST_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function buildQuery(params: Record<string, string>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) q.set(k, v);
  return q.toString();
}

async function sbGet<T>(jwt: string, table: string, params: Record<string, string>): Promise<T[]> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error("Missing Supabase env");

  const url = `${SUPABASE_URL}/rest/v1/${table}?${buildQuery(params)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${jwt}`,
      apikey: SUPABASE_ANON_KEY,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase query failed: ${table}: ${text}`);
  }

  return (await res.json()) as T[];
}

async function sbGetService<T>(table: string, params: Record<string, string>): Promise<T[]> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing Supabase service role env");

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
    throw new Error(`Supabase service query failed: ${table}: ${text}`);
  }

  return (await res.json()) as T[];
}

async function getRequester(jwt: string): Promise<{ id: string; email: string | null }> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error("Missing Supabase env");

  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${jwt}`,
      apikey: SUPABASE_ANON_KEY,
    },
  });

  if (!res.ok) throw new Error("Unauthorized");
  const u = (await res.json()) as any;
  return { id: String(u?.id || ""), email: u?.email ? String(u.email) : null };
}

async function getDisplayName(jwt: string, userId: string): Promise<string> {
  try {
    const rows = await sbGet<UserProfile>(jwt, "user_profiles", {
      select: "full_name,username",
      id: `eq.${userId}`,
      limit: "1",
    });

    const row = rows[0];
    return row?.full_name || row?.username || "Someone";
  } catch {
    return "Someone";
  }
}

async function getItemOwnerAndTitle(jwt: string, itemId: string): Promise<{ ownerId: string | null; itemTitle: string }> {
  const rows = await sbGet<ItemOwnerRow>(jwt, "wishlist_items", {
    select: "title,wishlists!inner(user_id)",
    id: `eq.${itemId}`,
    limit: "1",
  });

  const row = rows[0];
  return {
    ownerId: row?.wishlists?.user_id ?? null,
    itemTitle: row?.title ?? "item",
  };
}

/**
 * Send push notification to a user via OneSignal
 * Uses external_id targeting (matching Wakti pattern)
 * The external_id is the Supabase user ID, set via notificationsBridge.setNotificationUser()
 */
async function sendPushToUser(_jwt: string, userId: string, title: string, message: string, data?: Record<string, unknown>) {
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) throw new Error("Missing OneSignal env");

  console.log(JSON.stringify({ at: "sendPushToUser", userId, title, message }));
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

  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }

  const result = {
    ok: res.ok,
    status: res.status,
    userId,
    method: "external_id",
    text,
    json,
    recipients: (json as any)?.recipients ?? null,
  };
  console.log(
    JSON.stringify({
      at: "sendPushToUser",
      ...result,
    }),
  );
  if (!res.ok) {
    throw new Error(`OneSignal error: ${text}`);
  }

  return result;
}

async function sendPushToPlayerId(playerId: string, title: string, message: string, data?: Record<string, unknown>) {
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) throw new Error("Missing OneSignal env");

  const payload: Record<string, unknown> = {
    app_id: ONESIGNAL_APP_ID,
    include_player_ids: [playerId],
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

  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }

  const result = {
    ok: res.ok,
    status: res.status,
    playerId,
    text,
    json,
    recipients: (json as any)?.recipients ?? null,
  };

  console.log(JSON.stringify({ at: "sendPushToPlayerId", ...result }));
  if (!res.ok) {
    throw new Error(`OneSignal error: ${text}`);
  }

  return result;
}

async function sendPushToMultipleDevices(deviceIds: string[], title: string, message: string, data?: Record<string, unknown>) {
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) throw new Error("Missing OneSignal env");

  const payload: Record<string, unknown> = {
    app_id: ONESIGNAL_APP_ID,
    include_player_ids: deviceIds,
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

  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {}

  const result = {
    ok: res.ok,
    status: res.status,
    deviceIds,
    text,
    json,
    recipients: (json as any)?.recipients ?? null,
  };

  console.log(JSON.stringify({ at: "sendPushToMultipleDevices", ...result }));
  if (!res.ok) {
    throw new Error(`OneSignal error: ${text}`);
  }

  return result;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const authHeader = req.headers.get("authorization") || "";
    const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;

    if (!jwt) {
      return jsonResponse({ error: "Missing Authorization bearer token" }, 401);
    }

    const requester = await getRequester(jwt);
    if (!requester.id) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const body = (await req.json()) as PushDispatchBody;
    const title = "Wishly";

    console.log(
      JSON.stringify({
        at: "push-dispatch",
        requesterId: requester.id,
        type: (body as any)?.type,
        body,
      }),
    );

    if (body.type === "follow_request") {
      const follower = await sbGet<FollowerRow>(jwt, "followers", {
        select: "status",
        user_id: `eq.${requester.id}`,
        following_id: `eq.${body.targetUserId}`,
        limit: "1",
      });

      const status = follower[0]?.status;
      const name = await getDisplayName(jwt, requester.id);

      if (status === "pending") {
        await sendPushToUser(jwt, body.targetUserId, title, `${name} requested to follow you`, { type: "follow_request" });
      } else if (status === "accepted") {
        await sendPushToUser(jwt, body.targetUserId, title, `${name} started following you`, { type: "new_follower" });
      }

      return jsonResponse({ ok: true });
    }

    if (body.type === "follow_accepted") {
      const follower = await sbGet<FollowerRow>(jwt, "followers", {
        select: "status",
        user_id: `eq.${body.fromUserId}`,
        following_id: `eq.${requester.id}`,
        limit: "1",
      });

      const status = follower[0]?.status;
      if (status !== "accepted") {
        return jsonResponse({ error: "Not allowed" }, 403);
      }

      const name = await getDisplayName(jwt, requester.id);
      await sendPushToUser(jwt, body.fromUserId, title, `${name} accepted your follow request`, { type: "follow_accepted" });
      return jsonResponse({ ok: true });
    }

    if (body.type === "claim_created") {
      const reservations = await sbGet<ReservationRow>(jwt, "wishlist_reservations", {
        select: "id,status,item_id,reserved_by_id",
        item_id: `eq.${body.itemId}`,
        reserved_by_id: `eq.${requester.id}`,
        order: "created_at.desc",
        limit: "1",
      });

      const reservation = reservations[0];
      if (!reservation) {
        return jsonResponse({ error: "Reservation not found" }, 404);
      }

      const { ownerId, itemTitle } = await getItemOwnerAndTitle(jwt, body.itemId);
      if (!ownerId) {
        return jsonResponse({ error: "Owner not found" }, 404);
      }

      const claimerName = await getDisplayName(jwt, requester.id);
      const status = String(reservation.status || "");

      if (status === "pending") {
        await sendPushToUser(jwt, ownerId, title, `${claimerName} requested to claim “${itemTitle}”`, {
          type: "claim_requested",
          itemId: body.itemId,
        });
      } else if (status === "approved") {
        await sendPushToUser(jwt, ownerId, title, `${claimerName} claimed “${itemTitle}”`, {
          type: "claim_approved",
          itemId: body.itemId,
        });
      }

      return jsonResponse({ ok: true });
    }

    if (body.type === "claim_decision") {
      const reservations = await sbGet<ReservationRow>(jwt, "wishlist_reservations", {
        select: "id,status,item_id,reserved_by_id",
        id: `eq.${body.reservationId}`,
        limit: "1",
      });

      const reservation = reservations[0];
      if (!reservation) {
        return jsonResponse({ error: "Reservation not found" }, 404);
      }

      const { ownerId, itemTitle } = await getItemOwnerAndTitle(jwt, reservation.item_id);
      if (!ownerId || ownerId !== requester.id) {
        return jsonResponse({ error: "Not allowed" }, 403);
      }

      const ownerName = await getDisplayName(jwt, requester.id);
      if (body.decision === "approved") {
        await sendPushToUser(jwt, reservation.reserved_by_id, title, `${ownerName} approved your claim for “${itemTitle}”`, {
          type: "claim_approved",
          itemId: reservation.item_id,
        });
      } else {
        await sendPushToUser(jwt, reservation.reserved_by_id, title, `${ownerName} declined your claim for “${itemTitle}”`, {
          type: "claim_declined",
          itemId: reservation.item_id,
        });
      }

      return jsonResponse({ ok: true });
    }

    if (body.type === "unclaim_requested") {
      const reservations = await sbGet<ReservationRow>(jwt, "wishlist_reservations", {
        select: "id,status,item_id,reserved_by_id",
        id: `eq.${body.reservationId}`,
        limit: "1",
      });

      const reservation = reservations[0];
      if (!reservation) {
        return jsonResponse({ error: "Reservation not found" }, 404);
      }

      if (reservation.reserved_by_id !== requester.id) {
        return jsonResponse({ error: "Not allowed" }, 403);
      }

      const { ownerId, itemTitle } = await getItemOwnerAndTitle(jwt, reservation.item_id);
      if (!ownerId) {
        return jsonResponse({ error: "Owner not found" }, 404);
      }

      const name = await getDisplayName(jwt, requester.id);
      await sendPushToUser(jwt, ownerId, title, `${name} requested to unclaim “${itemTitle}”`, {
        type: "unclaim_requested",
        itemId: reservation.item_id,
      });

      return jsonResponse({ ok: true });
    }

    if (body.type === "unclaim_approved") {
      const { ownerId, itemTitle } = await getItemOwnerAndTitle(jwt, body.itemId);
      if (!ownerId || ownerId !== requester.id) {
        return jsonResponse({ error: "Not allowed" }, 403);
      }

      const ownerName = await getDisplayName(jwt, requester.id);
      await sendPushToUser(jwt, body.claimerId, title, `${ownerName} approved your unclaim for “${itemTitle}”`, {
        type: "unclaim_approved",
        itemId: body.itemId,
      });

      return jsonResponse({ ok: true });
    }

    if (body.type === "unclaim_declined") {
      const reservations = await sbGet<ReservationRow>(jwt, "wishlist_reservations", {
        select: "id,status,item_id,reserved_by_id",
        id: `eq.${body.reservationId}`,
        limit: "1",
      });

      const reservation = reservations[0];
      if (!reservation) {
        return jsonResponse({ error: "Reservation not found" }, 404);
      }

      const { ownerId, itemTitle } = await getItemOwnerAndTitle(jwt, reservation.item_id);
      if (!ownerId || ownerId !== requester.id) {
        return jsonResponse({ error: "Not allowed" }, 403);
      }

      const ownerName = await getDisplayName(jwt, requester.id);
      await sendPushToUser(jwt, reservation.reserved_by_id, title, `${ownerName} declined your unclaim request for “${itemTitle}”`, {
        type: "unclaim_declined",
        itemId: reservation.item_id,
      });

      return jsonResponse({ ok: true });
    }

    if (body.type === "message_sent") {
      const participants = await sbGet<ThreadParticipantRow>(jwt, "thread_participants", {
        select: "user_id",
        thread_id: `eq.${body.threadId}`,
      });

      const senderName = await getDisplayName(jwt, requester.id);
      const recipients = participants
        .map((p) => p.user_id)
        .filter((id) => id && id !== requester.id);

      const deduped = Array.from(new Set(recipients));

      const results: unknown[] = [];

      for (const uid of deduped) {
        const r = await sendPushToUser(jwt, uid, title, `${senderName} sent a message`, {
          type: "message",
          threadId: body.threadId,
        });

        let fallback: unknown = null;
        if ((r as any)?.recipients === 0) {
          try {
            const devices = SUPABASE_SERVICE_ROLE_KEY
              ? await sbGetService<PushDeviceRow>("user_push_devices", {
                  select: "onesignal_device_id",
                  user_id: `eq.${uid}`,
                  enabled: "eq.true",
                })
              : await sbGet<PushDeviceRow>(jwt, "user_push_devices", {
                  select: "onesignal_device_id",
                  user_id: `eq.${uid}`,
                  enabled: "eq.true",
                });

            if (devices.length > 0) {
              const deviceIds = devices.map(d => d.onesignal_device_id);
              fallback = await sendPushToMultipleDevices(deviceIds, title, `${senderName} sent a message`, {
                type: "message",
                threadId: body.threadId,
              });
            } else {
              fallback = { skipped: "no_active_devices" };
            }
          } catch {
            fallback = { skipped: "device_lookup_failed" };
          }
        }

        results.push({ primary: r, fallback });
      }

      return jsonResponse({ ok: true, recipients: deduped.length, results });
    }

    if (body.type === "comment_added") {
      const wishlists = await sbGet<WishlistRow>(jwt, "wishlists", {
        select: "user_id,title",
        id: `eq.${body.wishlistId}`,
        limit: "1",
      });

      const wishlist = wishlists[0];
      if (!wishlist) {
        return jsonResponse({ error: "Wishlist not found" }, 404);
      }

      if (wishlist.user_id === requester.id) {
        return jsonResponse({ ok: true, skipped: "own_wishlist" });
      }

      const commenterName = await getDisplayName(jwt, requester.id);
      const wishlistTitle = wishlist.title || "your wishlist";

      const r = await sendPushToUser(jwt, wishlist.user_id, title, `${commenterName} commented on "${wishlistTitle}"`, {
        type: "comment",
        wishlistId: body.wishlistId,
      });

      let fallback: unknown = null;
      if ((r as any)?.recipients === 0) {
        try {
          const devices = SUPABASE_SERVICE_ROLE_KEY
            ? await sbGetService<PushDeviceRow>("user_push_devices", {
                select: "onesignal_device_id",
                user_id: `eq.${wishlist.user_id}`,
                enabled: "eq.true",
              })
            : await sbGet<PushDeviceRow>(jwt, "user_push_devices", {
                select: "onesignal_device_id",
                user_id: `eq.${wishlist.user_id}`,
                enabled: "eq.true",
              });

          if (devices.length > 0) {
            const deviceIds = devices.map(d => d.onesignal_device_id);
            fallback = await sendPushToMultipleDevices(deviceIds, title, `${commenterName} commented on "${wishlistTitle}"`, {
              type: "comment",
              wishlistId: body.wishlistId,
            });
          } else {
            fallback = { skipped: "no_active_devices" };
          }
        } catch {
          fallback = { skipped: "device_lookup_failed" };
        }
      }

      return jsonResponse({ ok: true, result: { primary: r, fallback } });
    }

    return jsonResponse({ error: "Unsupported type" }, 400);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.log(JSON.stringify({ at: "push-dispatch:error", error: message }));
    return jsonResponse({ error: message }, 500);
  }
});

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

type SendPushBody = {
  userId?: string;
  subscriptionId?: string;
  title?: string;
  message: string;
  data?: Record<string, unknown>;
};

const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID");
const ONESIGNAL_REST_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY");
const SUPERADMIN_EMAIL = (Deno.env.get("SUPERADMIN_EMAIL") || "admin@tmw.qa").toLowerCase();

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("authorization") || "";
    const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;

    if (!jwt) {
      return new Response(JSON.stringify({ error: "Missing Authorization bearer token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Missing OneSignal credentials in function secrets" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { userId, subscriptionId, title, message, data }: SendPushBody = await req.json();

    if (!message || (!userId && !subscriptionId)) {
      return new Response(JSON.stringify({ error: "message is required and either userId or subscriptionId must be provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        apikey: Deno.env.get("SUPABASE_ANON_KEY") || "",
      },
    });

    if (!userRes.ok) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const requester = await userRes.json();
    const requesterEmail = String(requester?.email || "").toLowerCase();

    if (!requesterEmail || requesterEmail !== SUPERADMIN_EMAIL) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const onesignalPayload: Record<string, unknown> = {
      app_id: ONESIGNAL_APP_ID,
      contents: { en: message },
    };

    if (userId) {
      onesignalPayload.include_external_user_ids = [userId];
      onesignalPayload.channel_for_external_user_ids = "push";
    } else if (subscriptionId) {
      onesignalPayload.include_player_ids = [subscriptionId];
    }

    if (title && title.trim()) {
      onesignalPayload.headings = { en: title.trim() };
    }

    if (data && typeof data === "object") {
      onesignalPayload.data = data;
    }

    const osRes = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify(onesignalPayload),
    });

    const osText = await osRes.text();

    if (!osRes.ok) {
      return new Response(
        JSON.stringify({ error: "OneSignal request failed", details: osText }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(osText, {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

type RegisterDeviceBody = {
  onesignalDeviceId: string;
  platform: 'ios' | 'android' | 'web';
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

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
      return new Response(JSON.stringify({ error: "Missing Authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user from JWT
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        apikey: SUPABASE_ANON_KEY || "",
      },
    });

    if (!userRes.ok) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const user = await userRes.json();
    const userId = user.id;

    const { onesignalDeviceId, platform }: RegisterDeviceBody = await req.json();

    if (!onesignalDeviceId || !platform) {
      return new Response(JSON.stringify({ error: "onesignalDeviceId and platform required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upsert device using service role key
    const upsertRes = await fetch(
      `${SUPABASE_URL}/rest/v1/user_push_devices?on_conflict=user_id,onesignal_device_id`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: SUPABASE_SERVICE_ROLE_KEY || "",
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates",
        },
        body: JSON.stringify({
          user_id: userId,
          onesignal_device_id: onesignalDeviceId,
          platform,
          enabled: true,
          last_seen_at: new Date().toISOString(),
        }),
      }
    );

    if (!upsertRes.ok) {
      const error = await upsertRes.text();
      console.error("Device registration failed:", error);
      return new Response(JSON.stringify({ error: "Registration failed", details: error }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(JSON.stringify({ 
      action: "device_registered", 
      userId, 
      deviceId: onesignalDeviceId, 
      platform 
    }));

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("Register device error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

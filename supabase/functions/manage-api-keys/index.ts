import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function hashKey(raw: string): Promise<string> {
  const enc = new TextEncoder().encode(raw);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function generateApiKey(): string {
  const chars = "ABCDEFGHJKLMNPRSTUVWXYZabcdefghjklmnprstuvwxyz0123456789";
  const random = crypto.getRandomValues(new Uint8Array(32));
  const suffix = Array.from(random).map(b => chars[b % chars.length]).join("");
  return `vsk_${suffix}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const url = new URL(req.url);
    const path = url.pathname;

    // POST /manage-api-keys/create
    if (req.method === "POST" && path.endsWith("/create")) {
      const body = await req.json().catch(() => ({}));
      const name = String(body?.name || "").trim();
      const owner_email = String(body?.owner_email || "").trim();
      const rate_limit_per_min = Number(body?.rate_limit_per_min) || 60;
      const expires_at = body?.expires_at || null;

      if (!name) return json({ error: "name is required" }, 400);

      const rawKey = generateApiKey();
      const key_hash = await hashKey(rawKey);
      const key_prefix = rawKey.slice(0, 12);

      const { data, error } = await supabase
        .from("api_keys")
        .insert({ key_hash, key_prefix, name, owner_email, rate_limit_per_min, expires_at })
        .select("id, key_prefix, name, owner_email, is_active, rate_limit_per_min, created_at, expires_at")
        .single();

      if (error) return json({ error: error.message }, 500);

      return json({ ...data, raw_key: rawKey, warning: "Store this key securely — it will not be shown again." });
    }

    // GET /manage-api-keys/list
    if (req.method === "GET" && path.endsWith("/list")) {
      const { data, error } = await supabase
        .from("api_keys")
        .select("id, key_prefix, name, owner_email, is_active, rate_limit_per_min, total_requests, last_used_at, created_at, expires_at")
        .order("created_at", { ascending: false });

      if (error) return json({ error: error.message }, 500);
      return json({ keys: data });
    }

    // GET /manage-api-keys/usage?key_id=...
    if (req.method === "GET" && path.endsWith("/usage")) {
      const keyId = url.searchParams.get("key_id");
      const limit = Math.min(Number(url.searchParams.get("limit") || 50), 200);

      let query = supabase
        .from("api_usage_logs")
        .select("id, vin, source, status_code, response_ms, ip_address, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (keyId) query = query.eq("api_key_id", keyId);

      const { data, error } = await query;
      if (error) return json({ error: error.message }, 500);
      return json({ logs: data });
    }

    // PATCH /manage-api-keys/update
    if (req.method === "PATCH" && path.endsWith("/update")) {
      const body = await req.json().catch(() => ({}));
      const { id, ...updates } = body;
      if (!id) return json({ error: "id is required" }, 400);

      const allowed = ["name", "owner_email", "is_active", "rate_limit_per_min", "expires_at"];
      const filtered = Object.fromEntries(Object.entries(updates).filter(([k]) => allowed.includes(k)));

      const { data, error } = await supabase
        .from("api_keys")
        .update(filtered)
        .eq("id", id)
        .select("id, key_prefix, name, owner_email, is_active, rate_limit_per_min, total_requests, last_used_at, created_at, expires_at")
        .single();

      if (error) return json({ error: error.message }, 500);
      return json(data);
    }

    // DELETE /manage-api-keys/revoke
    if (req.method === "DELETE" && path.endsWith("/revoke")) {
      const body = await req.json().catch(() => ({}));
      const id = body?.id || url.searchParams.get("id");
      if (!id) return json({ error: "id is required" }, 400);

      const { error } = await supabase
        .from("api_keys")
        .update({ is_active: false })
        .eq("id", id);

      if (error) return json({ error: error.message }, 500);
      return json({ success: true, message: "API key revoked." });
    }

    return json({ error: "Not found" }, 404);
  } catch (e) {
    console.error("manage-api-keys error", e);
    return json({ error: (e as Error).message }, 500);
  }
});

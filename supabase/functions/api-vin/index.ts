import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Api-Key",
};

const WMI_TABLE: Record<string, { make: string; country: string; manufacturer: string; model?: string; vehicle_type?: string }> = {
  KMH: { make: "Hyundai", country: "South Korea", manufacturer: "Hyundai Motor Company", vehicle_type: "Passenger Car" },
  KMJ: { make: "Hyundai", country: "South Korea", manufacturer: "Hyundai Motor Company", model: "Grand Starex / H-1", vehicle_type: "MPV / Van" },
  KNA: { make: "Kia", country: "South Korea", manufacturer: "Kia Motors", vehicle_type: "Passenger Car" },
  KND: { make: "Kia", country: "South Korea", manufacturer: "Kia Motors", vehicle_type: "SUV / MPV" },
  JHM: { make: "Honda", country: "Japan", manufacturer: "Honda Motor Co." },
  JT2: { make: "Toyota", country: "Japan", manufacturer: "Toyota" },
  JT3: { make: "Toyota", country: "Japan", manufacturer: "Toyota" },
  JTD: { make: "Toyota", country: "Japan", manufacturer: "Toyota" },
  JN1: { make: "Nissan", country: "Japan", manufacturer: "Nissan" },
  JM1: { make: "Mazda", country: "Japan", manufacturer: "Mazda" },
  JF1: { make: "Subaru", country: "Japan", manufacturer: "Subaru" },
  WBA: { make: "BMW", country: "Germany", manufacturer: "BMW AG" },
  WDB: { make: "Mercedes-Benz", country: "Germany", manufacturer: "Mercedes-Benz" },
  WDD: { make: "Mercedes-Benz", country: "Germany", manufacturer: "Mercedes-Benz" },
  W1K: { make: "Mercedes-Benz", country: "Germany", manufacturer: "Mercedes-Benz" },
  WAU: { make: "Audi", country: "Germany", manufacturer: "Audi AG" },
  WA1: { make: "Audi", country: "Germany", manufacturer: "Audi AG" },
  WVW: { make: "Volkswagen", country: "Germany", manufacturer: "Volkswagen" },
  WP0: { make: "Porsche", country: "Germany", manufacturer: "Porsche AG" },
  VF1: { make: "Renault", country: "France", manufacturer: "Renault" },
  VF3: { make: "Peugeot", country: "France", manufacturer: "Peugeot" },
  ZFA: { make: "Fiat", country: "Italy", manufacturer: "Fiat" },
  ZFF: { make: "Ferrari", country: "Italy", manufacturer: "Ferrari" },
  SAJ: { make: "Jaguar", country: "United Kingdom", manufacturer: "Jaguar" },
  SAL: { make: "Land Rover", country: "United Kingdom", manufacturer: "Land Rover" },
  SCA: { make: "Rolls-Royce", country: "United Kingdom", manufacturer: "Rolls-Royce" },
  "1FA": { make: "Ford", country: "United States", manufacturer: "Ford Motor Company" },
  "1FT": { make: "Ford", country: "United States", manufacturer: "Ford (Truck)", vehicle_type: "Pickup Truck" },
  "1G1": { make: "Chevrolet", country: "United States", manufacturer: "Chevrolet" },
  "1HG": { make: "Honda", country: "United States", manufacturer: "Honda USA" },
  "5YJ": { make: "Tesla", country: "United States", manufacturer: "Tesla, Inc." },
  "7SA": { make: "Tesla", country: "United States", manufacturer: "Tesla, Inc." },
  MAL: { make: "Hyundai", country: "India", manufacturer: "Hyundai Motor India" },
  RL4: { make: "VinFast", country: "Vietnam", manufacturer: "VinFast Trading and Production JSC", vehicle_type: "Car / SUV" },
  RL8: { make: "VinFast", country: "Vietnam", manufacturer: "VinFast Auto Ltd.", vehicle_type: "Electric Vehicle" },
  RLC: { make: "Toyota Vietnam", country: "Vietnam", manufacturer: "Toyota Motor Vietnam (TMV)", vehicle_type: "Car / MPV / SUV" },
  RLD: { make: "Ford Vietnam", country: "Vietnam", manufacturer: "Ford Vietnam Limited", vehicle_type: "Pickup / SUV" },
  RLH: { make: "Hyundai TC Motor", country: "Vietnam", manufacturer: "Hyundai Thanh Cong Vietnam", vehicle_type: "Car / SUV" },
  RLM: { make: "Thaco", country: "Vietnam", manufacturer: "Truong Hai Auto (THACO)", vehicle_type: "Truck / Bus / Car" },
};

const YEAR_BASE: Record<string, number> = {
  A: 1980, B: 1981, C: 1982, D: 1983, E: 1984, F: 1985, G: 1986, H: 1987,
  J: 1988, K: 1989, L: 1990, M: 1991, N: 1992, P: 1993, R: 1994, S: 1995,
  T: 1996, V: 1997, W: 1998, X: 1999, Y: 2000,
  "1": 2001, "2": 2002, "3": 2003, "4": 2004, "5": 2005,
  "6": 2006, "7": 2007, "8": 2008, "9": 2009,
};

function decodeYear(vin: string): string | null {
  if (vin.length < 10) return null;
  const c = vin[9].toUpperCase();
  const base = YEAR_BASE[c];
  if (base === undefined) return null;
  const currentYear = new Date().getFullYear();
  const candidates = [base, base + 30, base + 60].filter((y) => y <= currentYear + 1);
  return candidates.length ? String(Math.max(...candidates)) : String(base);
}

function offlineDecode(vin: string) {
  const wmi = vin.slice(0, 3).toUpperCase();
  const info = WMI_TABLE[wmi];
  const year = decodeYear(vin);
  const serial = vin.length >= 17 ? vin.slice(11) : vin.slice(Math.max(0, vin.length - 6));
  return {
    make: info?.make ?? null,
    model: info?.model ?? null,
    model_year: year,
    country: info?.country ?? null,
    manufacturer: info?.manufacturer ?? null,
    vehicle_type: info?.vehicle_type ?? null,
    serial_number: serial,
  };
}

function pickBetter(a: string | null | undefined, b: string | null | undefined) {
  return ((a ?? "").trim()) || ((b ?? "").trim()) || null;
}

async function hashKey(raw: string): Promise<string> {
  const enc = new TextEncoder().encode(raw);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function isValidVin(vin: string): boolean {
  return /^[A-HJ-NPR-Z0-9]{11,17}$/i.test(vin);
}

function errorResponse(message: string, status: number, code: string) {
  return new Response(
    JSON.stringify({ success: false, error: { code, message } }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const startMs = Date.now();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const url = new URL(req.url);

    // Route: GET /api-vin/docs → redirect to API docs info
    if (url.pathname.endsWith("/docs")) {
      return new Response(
        JSON.stringify({
          name: "VinSight API",
          version: "1.0",
          base_url: `${url.origin}/functions/v1/api-vin`,
          endpoints: {
            "GET /decode?vin=VINCODE": "Decode a VIN by query parameter",
            "POST /decode": "Decode a VIN via JSON body: { \"vin\": \"...\" }",
            "GET /health": "Health check",
          },
          authentication: "Pass your API key as X-Api-Key header or ?api_key= query param",
          rate_limit: "60 requests/minute (default)",
          response_format: {
            success: true,
            data: {
              vin: "string",
              make: "string | null",
              model: "string | null",
              model_year: "string | null",
              country: "string | null",
              manufacturer: "string | null",
              vehicle_type: "string | null",
              body_class: "string | null",
              plant: "string | null",
              engine: "string | null",
              serial_number: "string | null",
              source: "nhtsa+offline | offline",
            },
            meta: {
              request_id: "uuid",
              response_ms: "number",
            },
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Route: GET /api-vin/health
    if (url.pathname.endsWith("/health")) {
      return new Response(
        JSON.stringify({ success: true, status: "ok", timestamp: new Date().toISOString() }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ----- API Key Authentication -----
    const rawKey =
      req.headers.get("X-Api-Key") ||
      req.headers.get("x-api-key") ||
      url.searchParams.get("api_key");

    if (!rawKey) {
      return errorResponse(
        "Missing API key. Pass X-Api-Key header or ?api_key= query parameter.",
        401,
        "MISSING_API_KEY",
      );
    }

    const keyHash = await hashKey(rawKey);
    const { data: keyRow, error: keyErr } = await supabase
      .from("api_keys")
      .select("id, is_active, rate_limit_per_min, expires_at, name")
      .eq("key_hash", keyHash)
      .maybeSingle();

    if (keyErr || !keyRow) {
      return errorResponse("Invalid API key.", 401, "INVALID_API_KEY");
    }
    if (!keyRow.is_active) {
      return errorResponse("This API key has been disabled.", 403, "KEY_DISABLED");
    }
    if (keyRow.expires_at && new Date(keyRow.expires_at) < new Date()) {
      return errorResponse("This API key has expired.", 403, "KEY_EXPIRED");
    }

    // ----- Rate limit check (simple: count requests in last 60s) -----
    const oneMinAgo = new Date(Date.now() - 60_000).toISOString();
    const { count: recentCount } = await supabase
      .from("api_usage_logs")
      .select("id", { count: "exact", head: true })
      .eq("api_key_id", keyRow.id)
      .gte("created_at", oneMinAgo);

    if ((recentCount ?? 0) >= keyRow.rate_limit_per_min) {
      return errorResponse(
        `Rate limit exceeded: ${keyRow.rate_limit_per_min} requests/minute.`,
        429,
        "RATE_LIMIT_EXCEEDED",
      );
    }

    // ----- Parse VIN -----
    let vin = "";
    if (req.method === "GET") {
      vin = (url.searchParams.get("vin") ?? "").trim().toUpperCase();
    } else if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      vin = String(body?.vin ?? "").trim().toUpperCase();
    } else {
      return errorResponse("Method not allowed. Use GET or POST.", 405, "METHOD_NOT_ALLOWED");
    }

    if (!vin) {
      return errorResponse("Missing required parameter: vin", 400, "MISSING_VIN");
    }
    if (!isValidVin(vin)) {
      return errorResponse(
        "Invalid VIN. Must be 11-17 alphanumeric characters, excluding I, O, Q.",
        400,
        "INVALID_VIN",
      );
    }

    // ----- Decode -----
    let nhtsaData: Record<string, string> | null = null;
    let nhtsaUsable = false;
    try {
      const r = await fetch(
        `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`,
      );
      if (r.ok) {
        const j = await r.json();
        nhtsaData = j?.Results?.[0] ?? null;
        nhtsaUsable = !!(nhtsaData?.Make && nhtsaData.Make.trim().length > 0);
      }
    } catch (_) { /* ignore */ }

    const offline = offlineDecode(vin);
    const result = {
      vin,
      make: nhtsaUsable ? pickBetter(nhtsaData?.Make, offline.make) : offline.make,
      model: nhtsaUsable ? pickBetter(nhtsaData?.Model, offline.model) : offline.model,
      model_year: nhtsaUsable ? pickBetter(nhtsaData?.ModelYear, offline.model_year) : offline.model_year,
      country: nhtsaUsable ? pickBetter(nhtsaData?.PlantCountry, offline.country) : offline.country,
      manufacturer: nhtsaUsable ? pickBetter(nhtsaData?.Manufacturer, offline.manufacturer) : offline.manufacturer,
      body_class: nhtsaUsable ? (nhtsaData?.BodyClass || null) : null,
      vehicle_type: nhtsaUsable ? pickBetter(nhtsaData?.VehicleType, offline.vehicle_type) : offline.vehicle_type,
      plant: nhtsaUsable
        ? pickBetter([nhtsaData?.PlantCity, nhtsaData?.PlantCountry].filter(Boolean).join(", "), null)
        : null,
      engine: nhtsaUsable
        ? pickBetter(
            [nhtsaData?.EngineModel, nhtsaData?.DisplacementL ? `${nhtsaData.DisplacementL}L` : "", nhtsaData?.FuelTypePrimary]
              .filter(Boolean).join(" "),
            null,
          )
        : null,
      serial_number: offline.serial_number,
      source: nhtsaUsable ? "nhtsa+offline" : "offline",
    };

    const responseMs = Date.now() - startMs;
    const requestId = crypto.randomUUID();

    // ----- Save usage log + update counters -----
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || null;
    const ua = req.headers.get("user-agent") || null;

    await Promise.all([
      supabase.from("api_usage_logs").insert({
        api_key_id: keyRow.id,
        vin,
        source: result.source,
        status_code: 200,
        response_ms: responseMs,
        ip_address: ip,
        user_agent: ua,
      }),
      supabase.from("api_keys").update({
        total_requests: supabase.raw ? undefined : undefined,
        last_used_at: new Date().toISOString(),
      }).eq("id", keyRow.id),
    ]);

    // Also save to vin_lookups for history
    await supabase.from("vin_lookups").insert({
      vin: result.vin,
      make: result.make,
      model: result.model,
      model_year: result.model_year,
      country: result.country,
      manufacturer: result.manufacturer,
      plant: result.plant,
      serial_number: result.serial_number,
      engine: result.engine,
      body_class: result.body_class,
      vehicle_type: result.vehicle_type,
      source: `api:${result.source}`,
      raw: nhtsaData,
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: result,
        meta: { request_id: requestId, response_ms: responseMs },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("api-vin error", e);
    return errorResponse((e as Error).message || "Internal server error", 500, "INTERNAL_ERROR");
  }
});

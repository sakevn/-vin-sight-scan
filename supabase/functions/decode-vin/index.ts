import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// WMI table (first 3 chars). Model can be inferred for some specific WMIs.
const WMI_TABLE: Record<
  string,
  { make: string; country: string; manufacturer: string; model?: string; vehicle_type?: string }
> = {
  KMH: { make: "Hyundai", country: "Hàn Quốc", manufacturer: "Hyundai Motor Company", vehicle_type: "Xe con (Passenger Car)" },
  KMJ: { make: "Hyundai", country: "Hàn Quốc", manufacturer: "Hyundai Motor Company", model: "Grand Starex / H-1", vehicle_type: "MPV / Van" },
  KMF: { make: "Hyundai", country: "Hàn Quốc", manufacturer: "Hyundai Motor Company", vehicle_type: "Xe thương mại" },
  KMY: { make: "Daelim", country: "Hàn Quốc", manufacturer: "Daelim Motor", vehicle_type: "Mô tô" },
  KNA: { make: "Kia", country: "Hàn Quốc", manufacturer: "Kia Motors", vehicle_type: "Xe con" },
  KND: { make: "Kia", country: "Hàn Quốc", manufacturer: "Kia Motors", vehicle_type: "SUV / MPV" },
  KNM: { make: "Renault Samsung", country: "Hàn Quốc", manufacturer: "Renault Samsung Motors" },
  JHM: { make: "Honda", country: "Nhật Bản", manufacturer: "Honda Motor Co." },
  JH4: { make: "Acura", country: "Nhật Bản", manufacturer: "Honda Motor Co. (Acura)" },
  JT2: { make: "Toyota", country: "Nhật Bản", manufacturer: "Toyota" },
  JT3: { make: "Toyota", country: "Nhật Bản", manufacturer: "Toyota" },
  JTD: { make: "Toyota", country: "Nhật Bản", manufacturer: "Toyota" },
  JN1: { make: "Nissan", country: "Nhật Bản", manufacturer: "Nissan" },
  JN8: { make: "Nissan", country: "Nhật Bản", manufacturer: "Nissan" },
  JM1: { make: "Mazda", country: "Nhật Bản", manufacturer: "Mazda" },
  JF1: { make: "Subaru", country: "Nhật Bản", manufacturer: "Subaru" },
  WBA: { make: "BMW", country: "Đức", manufacturer: "BMW AG" },
  WBS: { make: "BMW M", country: "Đức", manufacturer: "BMW M GmbH" },
  WDB: { make: "Mercedes-Benz", country: "Đức", manufacturer: "Mercedes-Benz" },
  WDD: { make: "Mercedes-Benz", country: "Đức", manufacturer: "Mercedes-Benz" },
  W1K: { make: "Mercedes-Benz", country: "Đức", manufacturer: "Mercedes-Benz" },
  WAU: { make: "Audi", country: "Đức", manufacturer: "Audi AG" },
  WA1: { make: "Audi", country: "Đức", manufacturer: "Audi AG (SUV)" },
  WVW: { make: "Volkswagen", country: "Đức", manufacturer: "Volkswagen" },
  WP0: { make: "Porsche", country: "Đức", manufacturer: "Porsche AG" },
  WP1: { make: "Porsche", country: "Đức", manufacturer: "Porsche AG (SUV)" },
  VF1: { make: "Renault", country: "Pháp", manufacturer: "Renault" },
  VF3: { make: "Peugeot", country: "Pháp", manufacturer: "Peugeot" },
  VF7: { make: "Citroën", country: "Pháp", manufacturer: "Citroën" },
  ZFA: { make: "Fiat", country: "Ý", manufacturer: "Fiat" },
  ZAR: { make: "Alfa Romeo", country: "Ý", manufacturer: "Alfa Romeo" },
  ZFF: { make: "Ferrari", country: "Ý", manufacturer: "Ferrari" },
  ZHW: { make: "Lamborghini", country: "Ý", manufacturer: "Lamborghini" },
  SAJ: { make: "Jaguar", country: "Vương Quốc Anh", manufacturer: "Jaguar" },
  SAL: { make: "Land Rover", country: "Vương Quốc Anh", manufacturer: "Land Rover" },
  SCA: { make: "Rolls-Royce", country: "Vương Quốc Anh", manufacturer: "Rolls-Royce" },
  SCB: { make: "Bentley", country: "Vương Quốc Anh", manufacturer: "Bentley" },
  "1FA": { make: "Ford", country: "Hoa Kỳ", manufacturer: "Ford Motor Company" },
  "1FT": { make: "Ford", country: "Hoa Kỳ", manufacturer: "Ford (Truck)", vehicle_type: "Bán tải" },
  "1G1": { make: "Chevrolet", country: "Hoa Kỳ", manufacturer: "Chevrolet" },
  "1GC": { make: "Chevrolet", country: "Hoa Kỳ", manufacturer: "Chevrolet (Truck)", vehicle_type: "Bán tải" },
  "1HG": { make: "Honda", country: "Hoa Kỳ", manufacturer: "Honda USA" },
  "2T1": { make: "Toyota", country: "Canada", manufacturer: "Toyota Canada" },
  "3VW": { make: "Volkswagen", country: "Mexico", manufacturer: "Volkswagen Mexico" },
  "5YJ": { make: "Tesla", country: "Hoa Kỳ", manufacturer: "Tesla, Inc." },
  "7SA": { make: "Tesla", country: "Hoa Kỳ", manufacturer: "Tesla, Inc." },
  LSV: { make: "Volkswagen", country: "Trung Quốc", manufacturer: "SAIC Volkswagen" },
  LVS: { make: "Ford", country: "Trung Quốc", manufacturer: "Changan Ford" },
  MAL: { make: "Hyundai", country: "Ấn Độ", manufacturer: "Hyundai Motor India" },
  MA3: { make: "Suzuki", country: "Ấn Độ", manufacturer: "Maruti Suzuki" },

  // ===== Việt Nam =====
  // VinFast (WMI: RL4 cho xe con/SUV, RL8 cho xe điện đời mới, RLU cho xe máy điện)
  RL4: { make: "VinFast", country: "Việt Nam", manufacturer: "VinFast Trading and Production JSC", vehicle_type: "Xe con / SUV (xăng + điện)" },
  RL8: { make: "VinFast", country: "Việt Nam", manufacturer: "VinFast Auto Ltd.", vehicle_type: "Xe điện (VF e34/VF 5/VF 6/VF 7/VF 8/VF 9)" },
  RLU: { make: "VinFast", country: "Việt Nam", manufacturer: "VinFast (Xe máy điện)", vehicle_type: "Xe máy điện (Klara/Theon/Feliz/Evo)" },
  RLF: { make: "VinFast", country: "Việt Nam", manufacturer: "VinFast", vehicle_type: "Xe thương mại / xe buýt điện" },

  // Thaco — Trường Hải Auto Group (lắp ráp Kia, Mazda, Peugeot, BMW + xe tải/bus)
  RLM: { make: "Thaco", country: "Việt Nam", manufacturer: "Trường Hải Auto (THACO Auto Chu Lai)", vehicle_type: "Xe tải / bus / xe con (Kia, Mazda, Peugeot CKD)" },
  RLT: { make: "Thaco Truck", country: "Việt Nam", manufacturer: "Thaco Truck (Foton/Auman/Frontier/Ollin/Towner)", vehicle_type: "Xe tải nhẹ & nặng" },
  RLB: { make: "Thaco Bus", country: "Việt Nam", manufacturer: "Thaco Bus (Tracomeco)", vehicle_type: "Xe khách / xe buýt" },

  // TMT Motors (Cửu Long / Sinotruk / Wuling Hongguang Mini EV)
  RLN: { make: "TMT Motors", country: "Việt Nam", manufacturer: "TMT Motors (Cửu Long / Sinotruk / Wuling)", vehicle_type: "Xe tải, xe điện mini (Wuling Hongguang Mini EV)" },

  // Hyundai Thành Công Việt Nam (HTV) — Ninh Bình
  RLH: { make: "Hyundai Thành Công", country: "Việt Nam", manufacturer: "Hyundai Thành Công Việt Nam (HTV - Ninh Bình)", vehicle_type: "Xe con / SUV (Hyundai CKD VN)" },
  RLG: { make: "Hyundai Thành Công", country: "Việt Nam", manufacturer: "Hyundai Thành Công Thương Mại (Solati / xe thương mại)", vehicle_type: "Xe thương mại (Solati, Mighty, HD)" },

  // Toyota Việt Nam (TMV) — Vĩnh Phúc
  RLC: { make: "Toyota Việt Nam", country: "Việt Nam", manufacturer: "Toyota Motor Vietnam (TMV - Vĩnh Phúc)", vehicle_type: "Xe con / MPV / SUV (Toyota CKD VN)" },

  // Ford Việt Nam (Hải Dương)
  RLD: { make: "Ford Việt Nam", country: "Việt Nam", manufacturer: "Ford Vietnam Limited (Hải Dương)", vehicle_type: "Bán tải / SUV (Ranger / Everest / Territory CKD)" },

  // Mercedes-Benz Việt Nam (MBV - Gò Vấp, TP.HCM)
  RLE: { make: "Mercedes-Benz Việt Nam", country: "Việt Nam", manufacturer: "Mercedes-Benz Việt Nam (MBV)", vehicle_type: "Xe sang lắp ráp (C/E/GLC CKD)" },

  // Honda Việt Nam (HVN - Vĩnh Phúc)
  RLZ: { make: "Honda Việt Nam", country: "Việt Nam", manufacturer: "Honda Việt Nam (HVN - Vĩnh Phúc)", vehicle_type: "Xe máy / ô tô (Honda City CKD)" },

  // Suzuki Việt Nam (Đồng Nai)
  RLY: { make: "Suzuki Việt Nam", country: "Việt Nam", manufacturer: "Việt Nam Suzuki Corporation (Đồng Nai)", vehicle_type: "Xe máy / xe tải nhẹ (Carry)" },
};

// VIN year code (10th character). Letters cycle every 30 years.
// A=1980/2010, B=1981/2011, ..., E=1984/2014, ..., Y=2000/2030.
// Digits 1-9 = 2001-2009 (and again 2031+).
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
  // Pick the cycle (1980-2009 vs 2010-2039) closest to "today" but not in the future by more than ~1 year.
  const currentYear = new Date().getFullYear();
  const candidates = [base, base + 30, base + 60].filter((y) => y <= currentYear + 1);
  // Prefer the most recent valid candidate.
  const chosen = candidates.length ? Math.max(...candidates) : base;
  return String(chosen);
}

// Hyundai plant code (11th char) — well-known mapping
const HYUNDAI_PLANTS: Record<string, string> = {
  U: "Ulsan, Hàn Quốc",
  A: "Asan, Hàn Quốc",
  C: "Chennai, Ấn Độ",
  M: "Montgomery, Alabama, Hoa Kỳ",
  B: "Bắc Kinh, Trung Quốc (Beijing-Hyundai)",
  T: "Izmit, Thổ Nhĩ Kỳ",
  Z: "Nošovice, Cộng Hòa Séc",
};

// Hyundai engine code (8th char) — common values for Starex / H-1
const HYUNDAI_ENGINES: Record<string, string> = {
  R: "Diesel 2.5L CRDi (D4CB)",
  W: "Diesel 2.5L CRDi (biến thể)",
  D: "Diesel",
  G: "Xăng",
};

function offlineDecode(vin: string) {
  const wmi = vin.slice(0, 3).toUpperCase();
  const info = WMI_TABLE[wmi];
  const year = decodeYear(vin);
  const plantCode = vin[10]?.toUpperCase();
  const engineCode = vin[7]?.toUpperCase();
  const serial = vin.length >= 17 ? vin.slice(11) : vin.slice(Math.max(0, vin.length - 6));

  let plant: string | null = null;
  let engine: string | null = null;
  if (info?.make === "Hyundai" || info?.make === "Kia") {
    plant = (plantCode && HYUNDAI_PLANTS[plantCode]) || (plantCode ? `Mã nhà máy: ${plantCode}` : null);
  }
  if (info?.make === "Hyundai") {
    engine = (engineCode && HYUNDAI_ENGINES[engineCode]) || null;
  }

  return {
    make: info?.make ?? null,
    model: info?.model ?? null,
    model_year: year,
    country: info?.country ?? null,
    manufacturer: info?.manufacturer ?? null,
    body_class: null,
    vehicle_type: info?.vehicle_type ?? null,
    plant,
    engine,
    serial_number: serial,
  };
}

function isValidVin(vin: string): boolean {
  return /^[A-HJ-NPR-Z0-9]{11,17}$/i.test(vin);
}

function pickBetter(a: string | null | undefined, b: string | null | undefined) {
  const av = (a ?? "").trim();
  const bv = (b ?? "").trim();
  return av || bv || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { vin: rawVin } = await req.json();
    const vin = String(rawVin ?? "").trim().toUpperCase();

    if (!isValidVin(vin)) {
      return new Response(
        JSON.stringify({ error: "Mã VIN không hợp lệ. VIN phải 11-17 ký tự, không chứa I, O, Q." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 1) Try NHTSA
    let nhtsaData: Record<string, string> | null = null;
    let nhtsaUsable = false;
    try {
      const r = await fetch(
        `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`,
      );
      if (r.ok) {
        const j = await r.json();
        nhtsaData = j?.Results?.[0] ?? null;
        // Only consider NHTSA usable if it returned a Make (avoids "1,7,400" empty rows)
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
      body_class: nhtsaUsable ? pickBetter(nhtsaData?.BodyClass, offline.body_class) : offline.body_class,
      vehicle_type: nhtsaUsable ? pickBetter(nhtsaData?.VehicleType, offline.vehicle_type) : offline.vehicle_type,
      plant: nhtsaUsable
        ? pickBetter([nhtsaData?.PlantCity, nhtsaData?.PlantCountry].filter(Boolean).join(", "), offline.plant)
        : offline.plant,
      engine: nhtsaUsable
        ? pickBetter(
            [nhtsaData?.EngineModel, nhtsaData?.DisplacementL ? `${nhtsaData.DisplacementL}L` : "", nhtsaData?.FuelTypePrimary]
              .filter(Boolean)
              .join(" "),
            offline.engine,
          )
        : offline.engine,
      serial_number: offline.serial_number,
      source: nhtsaUsable ? "nhtsa+offline" : "offline",
      raw: nhtsaData ?? null,
    };

    // Save to DB (server-side, bypasses RLS via service role)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { error: insertErr } = await supabase.from("vin_lookups").insert({
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
      source: result.source,
      raw: result.raw,
    });
    if (insertErr) console.error("insert error", insertErr);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

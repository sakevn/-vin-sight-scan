// Edge function: scan-vin-ai
// Sử dụng Lovable AI Gateway (Gemini Vision) để đọc VIN từ ảnh khó (mờ, nghiêng, thiếu sáng).
// Nhận: { imageBase64: string (data URL hoặc base64 thuần), mimeType?: string }
// Trả: { vin: string | null, raw?: string, confidence?: "high" | "medium" | "low" }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const VIN_REGEX = /\b[A-HJ-NPR-Z0-9]{17}\b/;

const sanitizeVin = (text: string): string | null => {
  if (!text) return null;
  const upper = text
    .toUpperCase()
    .replace(/[IO]/g, "0")
    .replace(/Q/g, "0");
  const cleaned = upper.replace(/[^A-HJ-NPR-Z0-9]/g, "");
  for (let i = 0; i + 17 <= cleaned.length; i++) {
    const w = cleaned.slice(i, i + 17);
    if (VIN_REGEX.test(w)) return w;
  }
  return null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY chưa được cấu hình");

    const body = await req.json().catch(() => ({}));
    const imageBase64: string | undefined = body?.imageBase64;
    const mimeType: string = body?.mimeType || "image/jpeg";

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return new Response(
        JSON.stringify({ error: "Thiếu trường imageBase64" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Chuẩn hoá thành data URL
    const dataUrl = imageBase64.startsWith("data:")
      ? imageBase64
      : `data:${mimeType};base64,${imageBase64}`;

    const systemPrompt = `Bạn là chuyên gia đọc số khung VIN (Vehicle Identification Number) từ ảnh chụp tem xe.
Quy tắc VIN:
- Đúng 17 ký tự.
- Chỉ dùng chữ in hoa A-Z (TRỪ I, O, Q) và số 0-9.
- Thường khắc/in trên tem ở khung cửa, kính lái, hoặc khoang động cơ.
- Phân biệt: số 0 vs chữ O, số 1 vs chữ I, số 8 vs chữ B. VIN KHÔNG có I/O/Q.
Hãy nhìn kỹ ảnh và trích xuất CHÍNH XÁC chuỗi VIN. Nếu ảnh mờ/nghiêng/thiếu sáng, hãy phân tích từng ký tự cẩn thận.
Trả về JSON đúng định dạng tool đã cho.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: "Hãy đọc số VIN trong ảnh này." },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "report_vin",
              description: "Báo cáo số VIN đọc được từ ảnh",
              parameters: {
                type: "object",
                properties: {
                  vin: {
                    type: "string",
                    description: "Số VIN 17 ký tự, chỉ A-Z (trừ I/O/Q) và 0-9. Để chuỗi rỗng nếu không đọc được.",
                  },
                  confidence: {
                    type: "string",
                    enum: ["high", "medium", "low"],
                    description: "Mức độ tự tin về kết quả đọc",
                  },
                  notes: {
                    type: "string",
                    description: "Ghi chú ngắn (vd: ảnh mờ, ký tự khó đọc...)",
                  },
                },
                required: ["vin", "confidence"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "report_vin" } },
      }),
    });

    if (!aiRes.ok) {
      const text = await aiRes.text();
      console.error("Lovable AI error", aiRes.status, text);
      if (aiRes.status === 429) {
        return new Response(
          JSON.stringify({ error: "Đã vượt giới hạn yêu cầu AI, vui lòng thử lại sau ít phút." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (aiRes.status === 402) {
        return new Response(
          JSON.stringify({ error: "Hết tín dụng AI. Vui lòng nạp thêm trong Lovable AI workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ error: `Lỗi AI Gateway: ${aiRes.status}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await aiRes.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    let parsedVin: string | null = null;
    let confidence: string | undefined;
    let notes: string | undefined;
    let rawArgs = "";

    if (toolCall?.function?.arguments) {
      rawArgs = toolCall.function.arguments;
      try {
        const args = JSON.parse(rawArgs);
        parsedVin = sanitizeVin(args.vin || "");
        confidence = args.confidence;
        notes = args.notes;
      } catch (e) {
        console.error("Parse tool args error", e);
      }
    } else {
      // fallback: lấy text content
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content === "string") {
        parsedVin = sanitizeVin(content);
        rawArgs = content;
      }
    }

    return new Response(
      JSON.stringify({
        vin: parsedVin,
        confidence,
        notes,
        raw: rawArgs,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("scan-vin-ai error", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message || "Lỗi không xác định" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

import { useState } from "react";
import { Copy, Check, Code as Code2, Zap, Shield, BookOpen, Terminal } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const BASE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-vin`;

interface CodeBlockProps {
  code: string;
  language?: string;
}

const CodeBlock = ({ code, language = "bash" }: CodeBlockProps) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative group rounded-lg bg-[hsl(220_20%_5%)] border border-border/60 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/40">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{language}</span>
        <button
          onClick={copy}
          className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
      <pre className="p-4 text-sm overflow-x-auto font-mono-vin leading-relaxed text-slate-300 whitespace-pre">
        {code}
      </pre>
    </div>
  );
};

const SECTION_TABS = ["Bắt đầu", "Endpoints", "Ví dụ Code", "Response"] as const;
type Tab = typeof SECTION_TABS[number];

export const ApiDocs = () => {
  const [tab, setTab] = useState<Tab>("Bắt đầu");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold">Tài liệu API</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Tích hợp VinSight VIN Decoder vào ứng dụng của bạn qua REST API chuẩn JSON
        </p>
      </div>

      <div className="flex gap-1 p-1 rounded-lg bg-secondary/60 border border-border/60 w-fit">
        {SECTION_TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2 rounded-md text-sm font-medium transition-colors",
              tab === t
                ? "bg-primary text-primary-foreground shadow"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Bắt đầu" && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: <Key16 />, title: "1. Tạo API Key", desc: "Vào tab API Keys, tạo key mới cho ứng dụng của bạn." },
              { icon: <Zap className="h-4 w-4" />, title: "2. Gọi API", desc: "Gửi request với header X-Api-Key đến endpoint /decode." },
              { icon: <Shield className="h-4 w-4" />, title: "3. Nhận kết quả", desc: "Nhận JSON chuẩn với đầy đủ thông tin xe: hãng, mẫu, năm, quốc gia..." },
            ].map(item => (
              <Card key={item.title} className="p-4 border-border/60 bg-card/60">
                <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3">
                  {item.icon}
                </div>
                <h3 className="font-semibold text-sm mb-1">{item.title}</h3>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </Card>
            ))}
          </div>

          <div>
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Terminal className="h-4 w-4 text-primary" /> Base URL
            </h3>
            <CodeBlock code={BASE_URL} language="url" />
          </div>

          <div>
            <h3 className="font-semibold mb-2">Authentication</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Mọi request đều cần API key. Truyền qua header <code className="bg-secondary px-1 rounded text-xs">X-Api-Key</code> hoặc query param <code className="bg-secondary px-1 rounded text-xs">?api_key=</code>.
            </p>
            <CodeBlock
              code={`curl "${BASE_URL}/decode?vin=KMJWA37RBEU635150" \\
  -H "X-Api-Key: vsk_YOUR_API_KEY"`}
              language="bash"
            />
          </div>

          <Card className="p-4 border-amber-500/20 bg-amber-500/5">
            <p className="text-sm text-amber-400 font-medium mb-1">Rate Limiting</p>
            <p className="text-xs text-muted-foreground">
              Mặc định 60 requests/phút mỗi key. Khi vượt giới hạn, API trả về HTTP 429.
              Liên hệ để nâng cấp giới hạn.
            </p>
          </Card>
        </div>
      )}

      {tab === "Endpoints" && (
        <div className="space-y-5">
          {[
            {
              method: "GET",
              path: "/decode?vin=:vin",
              desc: "Giải mã VIN qua query parameter",
              params: [
                { name: "vin", type: "string", required: true, desc: "Mã VIN cần tra cứu (11-17 ký tự)" },
                { name: "api_key", type: "string", required: false, desc: "API key (hoặc dùng X-Api-Key header)" },
              ],
            },
            {
              method: "POST",
              path: "/decode",
              desc: "Giải mã VIN qua request body JSON",
              params: [
                { name: "vin", type: "string", required: true, desc: "Mã VIN cần tra cứu (11-17 ký tự)" },
              ],
            },
            {
              method: "GET",
              path: "/health",
              desc: "Kiểm tra trạng thái API (không cần API key)",
              params: [],
            },
            {
              method: "GET",
              path: "/docs",
              desc: "Xem thông tin API ở dạng JSON",
              params: [],
            },
          ].map(ep => (
            <Card key={ep.path} className="p-5 border-border/60">
              <div className="flex items-center gap-3 mb-3">
                <span className={cn(
                  "text-xs font-bold px-2 py-0.5 rounded",
                  ep.method === "GET" ? "bg-green-500/15 text-green-400" : "bg-blue-500/15 text-blue-400",
                )}>
                  {ep.method}
                </span>
                <code className="font-mono-vin text-sm text-foreground">{BASE_URL}{ep.path}</code>
              </div>
              <p className="text-sm text-muted-foreground mb-3">{ep.desc}</p>
              {ep.params.length > 0 && (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/40">
                      <th className="text-left py-1.5 text-muted-foreground font-medium pr-4">Param</th>
                      <th className="text-left py-1.5 text-muted-foreground font-medium pr-4">Type</th>
                      <th className="text-left py-1.5 text-muted-foreground font-medium pr-4">Required</th>
                      <th className="text-left py-1.5 text-muted-foreground font-medium">Mô tả</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ep.params.map(p => (
                      <tr key={p.name} className="border-b border-border/20">
                        <td className="py-1.5 pr-4 font-mono-vin text-primary">{p.name}</td>
                        <td className="py-1.5 pr-4 text-muted-foreground">{p.type}</td>
                        <td className="py-1.5 pr-4">{p.required ? <span className="text-amber-400">Yes</span> : <span className="text-muted-foreground">No</span>}</td>
                        <td className="py-1.5 text-muted-foreground">{p.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          ))}
        </div>
      )}

      {tab === "Ví dụ Code" && (
        <div className="space-y-5">
          <div>
            <h3 className="font-semibold mb-2 flex items-center gap-2"><Code2 className="h-4 w-4 text-primary" /> JavaScript / Node.js</h3>
            <CodeBlock
              language="javascript"
              code={`const VIN = "KMJWA37RBEU635150";
const API_KEY = "vsk_YOUR_API_KEY";

const response = await fetch(
  \`${BASE_URL}/decode?vin=\${VIN}\`,
  { headers: { "X-Api-Key": API_KEY } }
);

const { success, data } = await response.json();

if (success) {
  console.log(\`\${data.make} \${data.model} (\${data.model_year})\`);
  console.log("Country:", data.country);
  console.log("Source:", data.source);
}`}
            />
          </div>

          <div>
            <h3 className="font-semibold mb-2">Python</h3>
            <CodeBlock
              language="python"
              code={`import requests

VIN = "KMJWA37RBEU635150"
API_KEY = "vsk_YOUR_API_KEY"

response = requests.get(
    f"${BASE_URL}/decode",
    params={"vin": VIN},
    headers={"X-Api-Key": API_KEY}
)

result = response.json()
if result["success"]:
    data = result["data"]
    print(f"{data['make']} {data['model']} ({data['model_year']})")
    print(f"Country: {data['country']}")
`}
            />
          </div>

          <div>
            <h3 className="font-semibold mb-2">PHP</h3>
            <CodeBlock
              language="php"
              code={`<?php
$vin = "KMJWA37RBEU635150";
$apiKey = "vsk_YOUR_API_KEY";

$ch = curl_init("${BASE_URL}/decode?vin=$vin");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ["X-Api-Key: $apiKey"]);

$response = json_decode(curl_exec($ch), true);
curl_close($ch);

if ($response['success']) {
    $data = $response['data'];
    echo "{$data['make']} {$data['model']} ({$data['model_year']})\\n";
}
?>`}
            />
          </div>

          <div>
            <h3 className="font-semibold mb-2">cURL</h3>
            <CodeBlock
              language="bash"
              code={`# GET request
curl "${BASE_URL}/decode?vin=KMJWA37RBEU635150" \\
  -H "X-Api-Key: vsk_YOUR_API_KEY"

# POST request
curl -X POST "${BASE_URL}/decode" \\
  -H "X-Api-Key: vsk_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"vin": "KMJWA37RBEU635150"}'`}
            />
          </div>
        </div>
      )}

      {tab === "Response" && (
        <div className="space-y-5">
          <div>
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Check className="h-4 w-4 text-green-400" /> Thành công (200)
            </h3>
            <CodeBlock
              language="json"
              code={`{
  "success": true,
  "data": {
    "vin": "KMJWA37RBEU635150",
    "make": "Hyundai",
    "model": "Grand Starex / H-1",
    "model_year": "2014",
    "country": "South Korea",
    "manufacturer": "Hyundai Motor Company",
    "vehicle_type": "MPV / Van",
    "body_class": null,
    "plant": "Ulsan, South Korea",
    "engine": "Diesel 2.5L CRDi (D4CB)",
    "serial_number": "635150",
    "source": "nhtsa+offline"
  },
  "meta": {
    "request_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "response_ms": 312
  }
}`}
            />
          </div>

          <div>
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <AlertIcon /> Lỗi
            </h3>
            <CodeBlock
              language="json"
              code={`{
  "success": false,
  "error": {
    "code": "INVALID_VIN",
    "message": "Invalid VIN. Must be 11-17 alphanumeric characters, excluding I, O, Q."
  }
}`}
            />
          </div>

          <Card className="p-4 border-border/60">
            <h3 className="font-semibold text-sm mb-3">HTTP Status Codes</h3>
            <table className="w-full text-xs">
              <tbody>
                {[
                  { code: "200", color: "text-green-400", desc: "Thành công" },
                  { code: "400", color: "text-amber-400", desc: "VIN không hợp lệ hoặc thiếu tham số" },
                  { code: "401", color: "text-red-400", desc: "API key không hợp lệ hoặc thiếu" },
                  { code: "403", color: "text-red-400", desc: "Key bị tắt hoặc hết hạn" },
                  { code: "429", color: "text-amber-400", desc: "Vượt rate limit" },
                  { code: "500", color: "text-red-400", desc: "Lỗi server" },
                ].map(row => (
                  <tr key={row.code} className="border-b border-border/20">
                    <td className={`py-1.5 pr-6 font-mono-vin font-bold ${row.color}`}>{row.code}</td>
                    <td className="py-1.5 text-muted-foreground">{row.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </div>
  );
};

const Key16 = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
  </svg>
);

const AlertIcon = () => (
  <svg className="h-4 w-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

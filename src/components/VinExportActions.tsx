import { useState } from "react";
import { Copy, Check, FileJson, FileSpreadsheet, FileText, FileDown, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { VinResult } from "./VinDecoder";

interface Props {
  result: VinResult;
}

const FIELDS: { key: keyof VinResult; label: string }[] = [
  { key: "vin", label: "VIN" },
  { key: "make", label: "Hãng sản xuất" },
  { key: "model", label: "Dòng xe" },
  { key: "model_year", label: "Năm sản xuất" },
  { key: "country", label: "Quốc gia" },
  { key: "manufacturer", label: "Nhà sản xuất" },
  { key: "body_class", label: "Kiểu thân xe" },
  { key: "vehicle_type", label: "Loại xe" },
  { key: "plant", label: "Nhà máy lắp ráp" },
  { key: "engine", label: "Động cơ" },
  { key: "serial_number", label: "Số seri sản xuất" },
  { key: "source", label: "Nguồn dữ liệu" },
];

const buildRows = (r: VinResult) =>
  FIELDS.map((f) => ({ "Thông tin": f.label, "Giá trị": (r[f.key] as string) || "—" }));

const buildText = (r: VinResult) =>
  FIELDS.map((f) => `${f.label}: ${(r[f.key] as string) || "—"}`).join("\n");

// Force UTF-8 by always wrapping text content with a BOM-prefixed Blob using a Uint8Array.
const downloadBytes = (bytes: BlobPart, filename: string, mime: string) => {
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const utf8Bytes = (s: string) => new TextEncoder().encode(s);
const withBom = (s: string) => {
  const body = utf8Bytes(s);
  const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
  const out = new Uint8Array(bom.length + body.length);
  out.set(bom, 0);
  out.set(body, bom.length);
  return out;
};

// Lazy-load and cache a Vietnamese-capable TTF (Noto Sans) for jsPDF.
let cachedFontBase64: string | null = null;
const NOTO_SANS_URL =
  "https://cdn.jsdelivr.net/npm/@fontsource/noto-sans@5.0.22/files/noto-sans-vietnamese-400-normal.woff";
// Fallback to TTF if WOFF can't be embedded (jsPDF needs TTF). We try TTF first.
const NOTO_SANS_TTF_URL =
  "https://raw.githubusercontent.com/notofonts/notofonts.github.io/main/fonts/NotoSans/hinted/ttf/NotoSans-Regular.ttf";

const loadFont = async (): Promise<string | null> => {
  if (cachedFontBase64) return cachedFontBase64;
  try {
    const res = await fetch(NOTO_SANS_TTF_URL);
    if (!res.ok) throw new Error("font fetch failed");
    const buf = new Uint8Array(await res.arrayBuffer());
    let binary = "";
    for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
    cachedFontBase64 = btoa(binary);
    return cachedFontBase64;
  } catch (e) {
    console.warn("Could not load Noto Sans, PDF will use built-in font", e);
    return null;
  }
};

export const VinExportActions = ({ result }: Props) => {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const base = `vin-${result.vin}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildText(result));
      setCopied(true);
      toast({ title: "Đã copy", description: "Thông tin xe đã được sao chép vào clipboard." });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Không thể copy", variant: "destructive" });
    }
  };

  const handleCSV = () => {
    const rows = buildRows(result);
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = [
      "Thông tin,Giá trị",
      ...rows.map((r) => `${escape(r["Thông tin"])},${escape(r["Giá trị"])}`),
    ].join("\r\n");
    // BOM + UTF-8 bytes ensures Excel/Numbers/LibreOffice mở đúng tiếng Việt
    downloadBytes(withBom(csv), `${base}.csv`, "text/csv;charset=utf-8");
  };

  const handleJSON = () => {
    // ensureAscii = false -> giữ nguyên ký tự Unicode (UTF-8) trong file
    const json = JSON.stringify(result, null, 2);
    downloadBytes(utf8Bytes(json), `${base}.json`, "application/json;charset=utf-8");
  };

  const handleXLSX = () => {
    const ws = XLSX.utils.json_to_sheet(buildRows(result));
    ws["!cols"] = [{ wch: 22 }, { wch: 60 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "VIN Info");
    // xlsx writes UTF-8 internally; bookType xlsx + binary buffer keeps Unicode intact
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
    downloadBytes(
      buf,
      `${base}.xlsx`,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
  };

  const handlePDF = async () => {
    setPdfLoading(true);
    try {
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();

      // Embed a Unicode TTF so Vietnamese diacritics render correctly.
      const fontB64 = await loadFont();
      let fontFamily = "helvetica";
      if (fontB64) {
        doc.addFileToVFS("NotoSans-Regular.ttf", fontB64);
        doc.addFont("NotoSans-Regular.ttf", "NotoSans", "normal");
        doc.addFont("NotoSans-Regular.ttf", "NotoSans", "bold");
        fontFamily = "NotoSans";
      } else {
        toast({
          title: "Đang dùng font dự phòng",
          description: "Không tải được font Unicode, dấu tiếng Việt có thể hiển thị sai.",
        });
      }

      doc.setFont(fontFamily, "bold");
      doc.setFontSize(18);
      doc.text("Báo cáo tra cứu VIN", 40, 56);

      doc.setFont(fontFamily, "normal");
      doc.setFontSize(10);
      doc.setTextColor(120);
      doc.text(`Xuất lúc ${new Date().toLocaleString("vi-VN")}`, 40, 74);
      doc.setTextColor(0);

      autoTable(doc, {
        startY: 96,
        head: [["Thông tin", "Giá trị"]],
        body: FIELDS.map((f) => [f.label, (result[f.key] as string) || "—"]),
        styles: {
          font: fontFamily,
          fontSize: 11,
          cellPadding: 8,
          textColor: [30, 30, 30],
          lineColor: [220, 220, 220],
          lineWidth: 0.5,
        },
        headStyles: {
          font: fontFamily,
          fontStyle: "bold",
          fillColor: [255, 138, 30],
          textColor: 255,
        },
        alternateRowStyles: { fillColor: [248, 248, 248] },
        columnStyles: {
          0: { cellWidth: 160, fontStyle: "bold" },
          1: { cellWidth: pageWidth - 80 - 160 },
        },
        margin: { left: 40, right: 40 },
      });

      doc.setFontSize(9);
      doc.setTextColor(140);
      doc.text(
        "VIN Decoder — Tra cứu mã VIN xe ô tô",
        40,
        doc.internal.pageSize.getHeight() - 24,
      );

      doc.save(`${base}.pdf`);
    } catch (e) {
      toast({
        title: "Không tạo được PDF",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 px-6 sm:px-8 py-4 border-t border-border/60 bg-secondary/30">
      <span className="text-xs uppercase tracking-wider text-muted-foreground mr-1">
        Xuất / Lưu trữ (UTF-8)
      </span>
      <Button variant="secondary" size="sm" onClick={handleCopy} className="gap-1.5">
        {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
        {copied ? "Đã copy" : "Copy"}
      </Button>
      <Button variant="outline" size="sm" onClick={handleCSV} className="gap-1.5">
        <FileText className="h-4 w-4" /> CSV
      </Button>
      <Button variant="outline" size="sm" onClick={handleJSON} className="gap-1.5">
        <FileJson className="h-4 w-4" /> JSON
      </Button>
      <Button variant="outline" size="sm" onClick={handleXLSX} className="gap-1.5">
        <FileSpreadsheet className="h-4 w-4" /> XLSX
      </Button>
      <Button variant="outline" size="sm" onClick={handlePDF} disabled={pdfLoading} className="gap-1.5">
        {pdfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
        PDF
      </Button>
    </div>
  );
};

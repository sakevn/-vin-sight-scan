import { useEffect, useRef, useState, useCallback } from "react";
import { Camera, X, Loader2, ScanLine, RefreshCw, ImagePlus, Zap, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import Tesseract from "tesseract.js";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDetected: (vin: string) => void;
}

const VIN_REGEX = /\b[A-HJ-NPR-Z0-9]{17}\b/;
const VIN_CHARSET = /[A-HJ-NPR-Z0-9]/g;

const sanitizeVinCandidate = (text: string): string | null => {
  const upper = text
    .toUpperCase()
    .replace(/[IO]/g, "0")
    .replace(/Q/g, "0");
  const cleaned = (upper.match(VIN_CHARSET) || []).join("");
  for (let i = 0; i + 17 <= cleaned.length; i++) {
    const window = cleaned.slice(i, i + 17);
    if (VIN_REGEX.test(window)) return window;
  }
  return null;
};

// Convert blob/file to base64 data URL
const fileToDataUrl = (file: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });

// Capture a frame from video → JPEG data URL (downscaled for AI cost)
const captureVideoFrame = (video: HTMLVideoElement, maxW = 1280): string | null => {
  if (video.readyState < 2 || video.videoWidth === 0) return null;
  const ratio = video.videoHeight / video.videoWidth;
  const w = Math.min(maxW, video.videoWidth);
  const h = Math.round(w * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.85);
};

export const VinScanner = ({ open, onOpenChange, onDetected }: Props) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const ocrRunningRef = useRef(false);
  const lastOcrAtRef = useRef(0);

  const [mode, setMode] = useState<"barcode" | "ocr" | "ai">("barcode");
  const [status, setStatus] = useState<string>("Đang khởi động camera...");
  const [error, setError] = useState<string | null>(null);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const { toast } = useToast();

  const stopAll = useCallback(() => {
    try { controlsRef.current?.stop(); } catch { /* noop */ }
    controlsRef.current = null;
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const handleSuccess = useCallback((vin: string) => {
    stopAll();
    toast({ title: "Đã quét được VIN", description: vin });
    onDetected(vin);
    onOpenChange(false);
  }, [onDetected, onOpenChange, stopAll, toast]);

  // Gọi Lovable AI Gemini Vision với 1 ảnh data URL
  const runAiOnDataUrl = useCallback(async (dataUrl: string) => {
    setAiBusy(true);
    setStatus("AI Vision đang phân tích ảnh...");
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("scan-vin-ai", {
        body: { imageBase64: dataUrl },
      });
      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(data.error);
      const vin = sanitizeVinCandidate(data?.vin || "");
      if (vin) {
        const conf = data?.confidence ? ` (độ tin cậy: ${data.confidence})` : "";
        toast({ title: "AI đã đọc được VIN" + conf, description: vin });
        handleSuccess(vin);
      } else {
        toast({
          title: "AI không đọc rõ VIN",
          description: data?.notes || "Hãy chụp gần hơn, đủ sáng và VIN nằm thẳng trong khung.",
          variant: "destructive",
        });
        setStatus("Đưa mã VIN vào trong khung");
      }
    } catch (e) {
      toast({
        title: "Lỗi AI Vision",
        description: (e as Error).message || "Không gọi được AI",
        variant: "destructive",
      });
      setStatus("Đưa mã VIN vào trong khung");
    } finally {
      setAiBusy(false);
    }
  }, [handleSuccess, toast]);

  // Chụp frame hiện tại + gửi lên AI
  const handleAiSnap = useCallback(async () => {
    if (!videoRef.current) return;
    const dataUrl = captureVideoFrame(videoRef.current);
    if (!dataUrl) {
      toast({ title: "Camera chưa sẵn sàng", variant: "destructive" });
      return;
    }
    await runAiOnDataUrl(dataUrl);
  }, [runAiOnDataUrl, toast]);

  const runOcrFrame = useCallback(async () => {
    if (ocrRunningRef.current || !videoRef.current) return;
    const video = videoRef.current;
    if (video.readyState < 2 || video.videoWidth === 0) return;

    ocrRunningRef.current = true;
    setOcrBusy(true);
    try {
      const w = video.videoWidth;
      const h = video.videoHeight;
      const cropW = Math.floor(w * 0.86);
      const cropH = Math.floor(h * 0.18);
      const cropX = Math.floor((w - cropW) / 2);
      const cropY = Math.floor((h - cropH) / 2);

      const canvas = document.createElement("canvas");
      canvas.width = cropW;
      canvas.height = cropH;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

      const img = ctx.getImageData(0, 0, cropW, cropH);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const gray = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
        const v = gray > 130 ? 255 : 0;
        d[i] = d[i + 1] = d[i + 2] = v;
      }
      ctx.putImageData(img, 0, 0);

      const { data } = await Tesseract.recognize(canvas, "eng", {
        // @ts-expect-error tesseract param
        tessedit_char_whitelist: "ABCDEFGHJKLMNPRSTUVWXYZ0123456789",
      });
      const vin = sanitizeVinCandidate(data.text || "");
      if (vin) handleSuccess(vin);
    } catch (e) {
      console.error("OCR error", e);
    } finally {
      ocrRunningRef.current = false;
      setOcrBusy(false);
      lastOcrAtRef.current = Date.now();
    }
  }, [handleSuccess]);

  // Start camera + barcode scanner
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    setStatus("Đang khởi động camera...");

    const start = async () => {
      try {
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.CODE_39,
          BarcodeFormat.CODE_128,
          BarcodeFormat.DATA_MATRIX,
          BarcodeFormat.QR_CODE,
          BarcodeFormat.PDF_417,
        ]);
        hints.set(DecodeHintType.TRY_HARDER, true);
        const reader = new BrowserMultiFormatReader(hints);
        readerRef.current = reader;

        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        };

        const controls = await reader.decodeFromConstraints(
          constraints,
          videoRef.current!,
          (result, _err) => {
            if (cancelled) return;
            if (result) {
              const text = result.getText();
              const vin = sanitizeVinCandidate(text);
              if (vin) handleSuccess(vin);
            }
          },
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
        setStatus("Đưa mã VIN vào trong khung");
      } catch (e) {
        const msg = (e as Error).message || "Không truy cập được camera";
        setError(msg);
        setStatus("");
      }
    };

    start();

    return () => {
      cancelled = true;
      stopAll();
    };
  }, [open, handleSuccess, stopAll]);

  // OCR loop chỉ khi mode === "ocr"
  useEffect(() => {
    if (!open || mode !== "ocr") return;
    const interval = setInterval(() => {
      if (Date.now() - lastOcrAtRef.current > 1200) runOcrFrame();
    }, 800);
    return () => clearInterval(interval);
  }, [open, mode, runOcrFrame]);

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Nếu đang ở chế độ AI → gửi thẳng lên AI Vision
    if (mode === "ai") {
      try {
        const dataUrl = await fileToDataUrl(file);
        await runAiOnDataUrl(dataUrl);
      } finally {
        if (e.target) e.target.value = "";
      }
      return;
    }

    setOcrBusy(true);
    setStatus("Đang nhận dạng VIN từ ảnh...");
    try {
      const reader = new BrowserMultiFormatReader();
      const url = URL.createObjectURL(file);
      try {
        const result = await reader.decodeFromImageUrl(url);
        const vin = sanitizeVinCandidate(result.getText());
        if (vin) {
          URL.revokeObjectURL(url);
          handleSuccess(vin);
          return;
        }
      } catch { /* fall through to OCR */ }

      const { data } = await Tesseract.recognize(file, "eng", {
        // @ts-expect-error tesseract param
        tessedit_char_whitelist: "ABCDEFGHJKLMNPRSTUVWXYZ0123456789",
      });
      URL.revokeObjectURL(url);
      const vin = sanitizeVinCandidate(data.text || "");
      if (vin) handleSuccess(vin);
      else {
        // Nếu OCR fail → đề xuất AI Vision
        toast({
          title: "Không tìm thấy VIN",
          description: "Hãy thử chế độ AI Vision (chính xác hơn cho ảnh khó).",
          variant: "destructive",
        });
        setStatus("Đưa mã VIN vào trong khung");
      }
    } finally {
      setOcrBusy(false);
      if (e.target) e.target.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) stopAll(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden bg-card border-border/60">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-primary" />
            Quét mã VIN bằng camera
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Hỗ trợ mã vạch, OCR chữ in và <span className="text-primary font-semibold">AI Vision</span> cho ảnh khó (mờ, nghiêng, thiếu sáng).
          </DialogDescription>
        </DialogHeader>

        <div className="relative aspect-[4/3] sm:aspect-video bg-black">
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            playsInline
            muted
            autoPlay
          />

          {/* Scan guide overlay */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 bg-black/40" style={{
              maskImage: "linear-gradient(#000,#000)",
              WebkitMaskImage: "linear-gradient(#000,#000)",
            }} />
            <div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg border-2 border-primary shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]"
              style={{ width: "86%", height: "18%" }}
            >
              <motion.div
                className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent"
                animate={{ top: ["0%", "100%", "0%"] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              />
              <span className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-primary" />
              <span className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-primary" />
              <span className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-primary" />
              <span className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-primary" />
            </div>
          </div>

          {/* Status pill */}
          <AnimatePresence>
            {status && !error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-background/80 backdrop-blur text-xs text-foreground border border-border/60 flex items-center gap-1.5"
              >
                {ocrBusy || aiBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3 text-primary" />}
                {status}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Mode toggle */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1 p-1 rounded-full bg-background/80 backdrop-blur border border-border/60">
            <button
              type="button"
              onClick={() => setMode("barcode")}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                mode === "barcode" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Zap className="h-3 w-3 inline mr-1" /> Mã vạch
            </button>
            <button
              type="button"
              onClick={() => setMode("ocr")}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                mode === "ocr" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ScanLine className="h-3 w-3 inline mr-1" /> OCR
            </button>
            <button
              type="button"
              onClick={() => setMode("ai")}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                mode === "ai" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Sparkles className="h-3 w-3 inline mr-1" /> AI Vision
            </button>
          </div>

          {/* Error overlay */}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/90 p-6 text-center">
              <div className="max-w-sm">
                <div className="text-destructive font-semibold mb-2">Không truy cập được camera</div>
                <p className="text-sm text-muted-foreground mb-4">{error}</p>
                <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
                  <X className="h-4 w-4 mr-1" /> Đóng
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-border/60 bg-secondary/30">
          <div className="text-xs text-muted-foreground hidden sm:block">
            {mode === "ai"
              ? "AI Vision: chụp/tải ảnh → Gemini đọc VIN cực chính xác."
              : "Mẹo: bật đèn pin và giữ máy cách tem VIN ~15cm."}
          </div>
          <div className="flex flex-wrap gap-2 ml-auto">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFilePick}
            />

            {mode === "ai" && (
              <Button
                size="sm"
                onClick={handleAiSnap}
                disabled={aiBusy || !!error}
                className="bg-gradient-to-r from-primary to-[hsl(var(--primary-glow))] text-primary-foreground"
              >
                {aiBusy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
                Quét bằng AI
              </Button>
            )}

            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={ocrBusy || aiBusy}>
              <ImagePlus className="h-4 w-4 mr-1" /> Tải ảnh
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => { stopAll(); setTimeout(() => { setError(null); setStatus("Đang khởi động camera..."); onOpenChange(false); setTimeout(() => onOpenChange(true), 100); }, 50); }}
              disabled={ocrBusy || aiBusy}
            >
              <RefreshCw className="h-4 w-4 mr-1" /> Khởi động lại
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

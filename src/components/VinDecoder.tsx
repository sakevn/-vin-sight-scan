import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Loader2, Car, MapPin, Calendar, Factory, Hash, Wrench, Building2, Cpu, Fingerprint, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { VinExportActions } from "./VinExportActions";
import { VinScanner } from "./VinScanner";

export interface VinResult {
  vin: string;
  make: string | null;
  model: string | null;
  model_year: string | null;
  country: string | null;
  manufacturer: string | null;
  body_class: string | null;
  vehicle_type: string | null;
  plant: string | null;
  engine: string | null;
  serial_number: string | null;
  source: string;
}

interface Props {
  onDecoded: (r: VinResult) => void;
}

export const VinDecoder = ({ onDecoded }: Props) => {
  const [vin, setVin] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VinResult | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const { toast } = useToast();

  const handleScanned = async (scannedVin: string) => {
    setVin(scannedVin);
    // Auto-decode
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("decode-vin", {
        body: { vin: scannedVin },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data as VinResult);
      onDecoded(data as VinResult);
    } catch (e) {
      toast({ title: "Không tra cứu được", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDecode = async () => {
    const cleaned = vin.trim().toUpperCase();
    if (cleaned.length < 11) {
      toast({ title: "VIN quá ngắn", description: "VIN cần tối thiểu 11 ký tự.", variant: "destructive" });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("decode-vin", {
        body: { vin: cleaned },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data as VinResult);
      onDecoded(data as VinResult);
    } catch (e) {
      toast({
        title: "Không tra cứu được",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Hash className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            value={vin}
            onChange={(e) => setVin(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && handleDecode()}
            placeholder="Nhập mã VIN (VD: KMJWA37RBEU635150)"
            maxLength={17}
            className="font-mono-vin h-14 pl-12 pr-14 text-base bg-secondary/60 border-border/60 focus-visible:ring-primary"
          />
          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            aria-label="Quét mã VIN bằng camera"
            className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-md flex items-center justify-center text-primary hover:bg-primary/10 transition-colors"
          >
            <ScanLine className="h-5 w-5" />
          </button>
        </div>
        <Button
          onClick={handleDecode}
          disabled={loading}
          size="lg"
          className="h-14 px-8 text-base font-semibold bg-gradient-to-r from-primary to-[hsl(var(--primary-glow))] text-primary-foreground hover:opacity-90 shadow-[var(--shadow-amber)]"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
          <span className="ml-2">Tra cứu</span>
        </Button>
      </div>

      <div className="mt-3 flex justify-center sm:hidden">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setScannerOpen(true)}
          className="gap-1.5 border-primary/40 text-primary"
        >
          <ScanLine className="h-4 w-4" /> Quét VIN bằng camera
        </Button>
      </div>

      <VinScanner open={scannerOpen} onOpenChange={setScannerOpen} onDetected={handleScanned} />

      <AnimatePresence mode="wait">
        {result && (
          <motion.div
            key={result.vin + result.source}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="mt-8"
          >
            <Card className="overflow-hidden border-border/60 bg-card/80 backdrop-blur shadow-[var(--shadow-card)]">
              <div className="p-6 sm:p-8 bg-gradient-to-br from-primary/10 via-transparent to-transparent border-b border-border/60">
                <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary font-semibold">
                  <Car className="h-4 w-4" />
                  Thông tin xe
                </div>
                <h2 className="font-display text-3xl sm:text-4xl font-bold mt-2">
                  {[result.make, result.model, result.model_year].filter(Boolean).join(" ") || "Không xác định"}
                </h2>
                <p className="font-mono-vin text-sm text-muted-foreground mt-2 break-all">{result.vin}</p>
                <div className="mt-3 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-secondary border border-border/60 text-muted-foreground">
                  <span className={`w-1.5 h-1.5 rounded-full ${result.source.includes("nhtsa") ? "bg-green-400" : "bg-amber-400"}`} />
                  Nguồn: {result.source.includes("nhtsa") ? "NHTSA + WMI offline" : "WMI offline"}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border/60">
                <InfoRow icon={<Factory className="h-4 w-4" />} label="Hãng sản xuất" value={result.manufacturer} />
                <InfoRow icon={<MapPin className="h-4 w-4" />} label="Quốc gia" value={result.country} />
                <InfoRow icon={<Calendar className="h-4 w-4" />} label="Năm sản xuất" value={result.model_year} />
                <InfoRow icon={<Wrench className="h-4 w-4" />} label="Loại xe" value={result.vehicle_type || result.body_class} />
                <InfoRow icon={<Building2 className="h-4 w-4" />} label="Nhà máy lắp ráp" value={result.plant} />
                <InfoRow icon={<Cpu className="h-4 w-4" />} label="Động cơ" value={result.engine} />
                <InfoRow icon={<Fingerprint className="h-4 w-4" />} label="Số seri sản xuất" value={result.serial_number} mono />
              </div>

              <VinExportActions result={result} />
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const InfoRow = ({
  icon,
  label,
  value,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  mono?: boolean;
}) => (
  <div className="p-5 sm:p-6 flex items-start gap-3">
    <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
      {icon}
    </div>
    <div className="min-w-0">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-medium mt-1 truncate ${mono ? "font-mono-vin" : ""}`}>{value || "—"}</div>
    </div>
  </div>
);

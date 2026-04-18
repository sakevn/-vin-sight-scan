import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";

interface Row {
  id: string;
  vin: string;
  make: string | null;
  model: string | null;
  model_year: string | null;
  country: string | null;
  created_at: string;
}

export const VinHistory = ({ refreshKey }: { refreshKey: number }) => {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await (supabase as any)
        .from("vin_lookups")
        .select("id, vin, make, model, model_year, country, created_at")
        .order("created_at", { ascending: false })
        .limit(12);
      if (active && data) setRows(data as Row[]);
    })();
    return () => { active = false; };
  }, [refreshKey]);

  if (!rows.length) return null;

  return (
    <div className="w-full max-w-3xl mx-auto mt-16">
      <div className="flex items-center gap-2 mb-4 text-sm uppercase tracking-widest text-muted-foreground font-semibold">
        <Clock className="h-4 w-4" />
        Tra cứu gần đây
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {rows.map((r) => (
          <Card key={r.id} className="p-4 bg-card/60 border-border/60 hover:border-primary/40 transition-colors">
            <div className="font-mono-vin text-xs text-muted-foreground truncate">{r.vin}</div>
            <div className="font-display font-semibold mt-1 truncate">
              {[r.make, r.model, r.model_year].filter(Boolean).join(" ") || "Không xác định"}
            </div>
            <div className="text-xs text-muted-foreground mt-1">{r.country || "—"}</div>
          </Card>
        ))}
      </div>
    </div>
  );
};

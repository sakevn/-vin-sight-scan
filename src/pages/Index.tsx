import { useState } from "react";
import { motion } from "framer-motion";
import { VinDecoder } from "@/components/VinDecoder";
import { VinHistory } from "@/components/VinHistory";

const Index = () => {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <main className="min-h-screen relative overflow-hidden">
      {/* Decorative grid */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <header className="relative z-10 max-w-6xl mx-auto px-6 pt-8 flex items-center justify-between">
        <div className="flex items-center gap-2 font-display font-bold text-lg">
          <span className="h-7 w-7 rounded-md bg-gradient-to-br from-primary to-[hsl(var(--primary-glow))] flex items-center justify-center text-primary-foreground text-xs">VIN</span>
          Decoder
        </div>
        <a
          href="https://en.wikipedia.org/wiki/Vehicle_identification_number"
          target="_blank"
          rel="noreferrer"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          VIN là gì?
        </a>
      </header>

      <section className="relative z-10 max-w-6xl mx-auto px-6 pt-16 sm:pt-24 pb-10 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-block text-xs uppercase tracking-[0.3em] text-primary font-semibold mb-5 px-3 py-1 rounded-full border border-primary/30 bg-primary/5">
            Vehicle Identification Number
          </div>
          <h1 className="font-display text-4xl sm:text-6xl font-bold leading-[1.05]">
            Giải mã <span className="bg-gradient-to-r from-primary to-[hsl(var(--primary-glow))] bg-clip-text text-transparent">mã VIN</span><br className="hidden sm:block" />
            của bất kỳ chiếc xe nào
          </h1>
          <p className="mt-5 text-muted-foreground max-w-xl mx-auto text-base sm:text-lg">
            Nhập 17 ký tự VIN để biết hãng, mẫu xe, năm sản xuất và quốc gia. Dữ liệu từ NHTSA + bảng WMI offline cho hơn 50 hãng xe toàn cầu.
          </p>
        </motion.div>
      </section>

      <section className="relative z-10 px-6 pb-24">
        <VinDecoder onDecoded={() => setRefreshKey((k) => k + 1)} />
        <VinHistory refreshKey={refreshKey} />
      </section>
    </main>
  );
};

export default Index;

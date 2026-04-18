import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowLeft, Code as Code2, Key, BookOpen } from "lucide-react";
import { ApiKeyManager } from "@/components/ApiKeyManager";
import { ApiDocs } from "@/components/ApiDocs";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "keys", label: "API Keys", icon: <Key className="h-4 w-4" /> },
  { id: "docs", label: "Tài liệu", icon: <BookOpen className="h-4 w-4" /> },
] as const;

type TabId = typeof TABS[number]["id"];

const ApiPortal = () => {
  const [tab, setTab] = useState<TabId>("keys");

  return (
    <main className="min-h-screen relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <header className="relative z-10 max-w-6xl mx-auto px-6 pt-8 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-display font-bold text-lg">
          <span className="h-7 w-7 rounded-md bg-gradient-to-br from-primary to-[hsl(var(--primary-glow))] flex items-center justify-center text-primary-foreground text-xs">VIN</span>
          Decoder
        </Link>
        <Link
          to="/"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Quay lại
        </Link>
      </header>

      <section className="relative z-10 max-w-6xl mx-auto px-6 pt-12 pb-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-primary font-semibold mb-4 px-3 py-1 rounded-full border border-primary/30 bg-primary/5">
            <Code2 className="h-3.5 w-3.5" /> Developer Portal
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold">
            VinSight <span className="bg-gradient-to-r from-primary to-[hsl(var(--primary-glow))] bg-clip-text text-transparent">Public API</span>
          </h1>
          <p className="mt-3 text-muted-foreground max-w-2xl text-base">
            Tích hợp giải mã VIN vào ứng dụng của bạn — app cho thuê xe, quản lý đội xe, bảo hiểm, đăng kiểm. REST API chuẩn JSON, hỗ trợ 50+ hãng xe toàn cầu.
          </p>
        </motion.div>
      </section>

      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-24">
        <div className="flex gap-1 p-1 rounded-xl bg-secondary/60 border border-border/60 w-fit mb-8">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors",
                tab === t.id
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          {tab === "keys" ? <ApiKeyManager /> : <ApiDocs />}
        </motion.div>
      </section>
    </main>
  );
};

export default ApiPortal;

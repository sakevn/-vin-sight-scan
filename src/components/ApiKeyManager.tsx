import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Key, Plus, Trash2, Copy, Check, Eye, EyeOff, RefreshCw, ShieldCheck, Clock, Activity, Loader as Loader2, CircleAlert as AlertCircle, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ApiKey {
  id: string;
  key_prefix: string;
  name: string;
  owner_email: string;
  is_active: boolean;
  rate_limit_per_min: number;
  total_requests: number;
  last_used_at: string | null;
  created_at: string;
  expires_at: string | null;
  raw_key?: string;
}

const invoke = async (path: string, method: string, body?: unknown) => {
  const base = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-api-keys/${path}`;
  const res = await fetch(base, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      Apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
};

export const ApiKeyManager = () => {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyEmail, setNewKeyEmail] = useState("");
  const [newKeyRate, setNewKeyRate] = useState("60");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { toast } = useToast();

  const loadKeys = useCallback(async () => {
    setLoading(true);
    try {
      const data = await invoke("list", "GET");
      setKeys(data.keys ?? []);
    } catch {
      toast({ title: "Lỗi tải danh sách key", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadKeys(); }, [loadKeys]);

  const handleCreate = async () => {
    if (!newKeyName.trim()) {
      toast({ title: "Tên key không được để trống", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const data = await invoke("create", "POST", {
        name: newKeyName.trim(),
        owner_email: newKeyEmail.trim(),
        rate_limit_per_min: Number(newKeyRate) || 60,
      });
      if (data.error) throw new Error(data.error);
      setKeys(prev => [data, ...prev]);
      setRevealedKey(data.raw_key);
      setShowForm(false);
      setNewKeyName("");
      setNewKeyEmail("");
      setNewKeyRate("60");
      toast({ title: "API Key đã được tạo", description: "Lưu key ngay — sẽ không hiển thị lại!" });
    } catch (e) {
      toast({ title: "Lỗi tạo key", description: (e as Error).message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (key: ApiKey) => {
    const data = await invoke("update", "PATCH", { id: key.id, is_active: !key.is_active });
    if (data.error) {
      toast({ title: "Lỗi cập nhật", variant: "destructive" });
      return;
    }
    setKeys(prev => prev.map(k => k.id === key.id ? { ...k, is_active: !k.is_active } : k));
    toast({ title: key.is_active ? "Key đã tắt" : "Key đã bật" });
  };

  const handleRevoke = async (key: ApiKey) => {
    if (!confirm(`Xác nhận xoá key "${key.name}"? Hành động này không thể hoàn tác.`)) return;
    const data = await invoke("revoke", "DELETE", { id: key.id });
    if (data.error) {
      toast({ title: "Lỗi xoá key", variant: "destructive" });
      return;
    }
    setKeys(prev => prev.filter(k => k.id !== key.id));
    toast({ title: "Key đã bị thu hồi" });
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold">API Keys</h2>
          <p className="text-muted-foreground text-sm mt-1">Quản lý quyền truy cập VinSight API cho ứng dụng của bạn</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadKeys} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button size="sm" onClick={() => setShowForm(!showForm)} className="gap-1.5 bg-gradient-to-r from-primary to-[hsl(var(--primary-glow))] text-primary-foreground">
            <Plus className="h-4 w-4" /> Tạo Key mới
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Card className="p-5 border-primary/30 bg-primary/5">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Key className="h-4 w-4 text-primary" /> Tạo API Key mới
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Tên ứng dụng *</label>
                  <Input
                    value={newKeyName}
                    onChange={e => setNewKeyName(e.target.value)}
                    placeholder="VD: App cho thuê xe ABC"
                    className="h-9"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Email liên hệ</label>
                  <Input
                    value={newKeyEmail}
                    onChange={e => setNewKeyEmail(e.target.value)}
                    placeholder="dev@company.com"
                    type="email"
                    className="h-9"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Rate limit (req/phút)</label>
                  <Input
                    value={newKeyRate}
                    onChange={e => setNewKeyRate(e.target.value)}
                    type="number"
                    min="1"
                    max="1000"
                    className="h-9"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button onClick={handleCreate} disabled={creating} size="sm" className="bg-gradient-to-r from-primary to-[hsl(var(--primary-glow))] text-primary-foreground">
                  {creating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                  Tạo key
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Huỷ</Button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {revealedKey && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
          >
            <Card className="p-5 border-amber-500/40 bg-amber-500/5">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-amber-400 mb-1">Lưu ngay API Key của bạn!</p>
                  <p className="text-xs text-muted-foreground mb-3">Key này sẽ không được hiển thị lại sau khi bạn đóng thông báo này.</p>
                  <div className="flex items-center gap-2 p-2 rounded bg-card border border-border/60 font-mono-vin text-sm break-all">
                    <span className="flex-1">{revealedKey}</span>
                    <button
                      onClick={() => copyToClipboard(revealedKey, "revealed")}
                      className="shrink-0 h-7 w-7 rounded flex items-center justify-center hover:bg-primary/10 text-primary"
                    >
                      {copiedId === "revealed" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <button onClick={() => setRevealedKey(null)} className="text-muted-foreground hover:text-foreground text-xs">Đóng</button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /> Đang tải...
        </div>
      ) : keys.length === 0 ? (
        <Card className="p-10 text-center border-dashed border-border/60">
          <Key className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground">Chưa có API key nào. Tạo key đầu tiên để bắt đầu tích hợp.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {keys.map(key => (
            <Card key={key.id} className={`p-5 border-border/60 transition-colors ${key.is_active ? "" : "opacity-60"}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold truncate">{key.name}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${key.is_active ? "border-green-500/30 bg-green-500/10 text-green-400" : "border-border/60 bg-secondary text-muted-foreground"}`}>
                      {key.is_active ? "Active" : "Disabled"}
                    </span>
                  </div>
                  {key.owner_email && (
                    <p className="text-xs text-muted-foreground mt-0.5">{key.owner_email}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <span className="font-mono-vin text-xs bg-secondary px-2 py-0.5 rounded border border-border/60 flex items-center gap-1.5">
                      <Key className="h-3 w-3 text-primary" />
                      {key.key_prefix}...
                      <button onClick={() => copyToClipboard(key.key_prefix, key.id)} className="text-primary hover:text-primary/70">
                        {copiedId === key.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Activity className="h-3 w-3" /> {key.rate_limit_per_min} req/min
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3" /> {key.total_requests} requests
                    </span>
                    {key.last_used_at && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {new Date(key.last_used_at).toLocaleDateString("vi-VN")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleToggle(key)}
                    className={`h-8 w-8 rounded flex items-center justify-center transition-colors ${key.is_active ? "text-green-400 hover:bg-green-500/10" : "text-muted-foreground hover:bg-secondary"}`}
                    title={key.is_active ? "Tắt key" : "Bật key"}
                  >
                    {key.is_active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => handleRevoke(key)}
                    className="h-8 w-8 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Thu hồi key"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

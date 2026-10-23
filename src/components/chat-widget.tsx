"use client";

/**
 * «پیام به استاد» — چت شناور با استاد تحفیظ (LLM)
 * قانون: کاربر تا لاگین نکند نمی‌تواند پیام بدهد.
 */
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { Loader2, LogIn, MessageCircle, SendHorizonal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-store";
import { useToast } from "@/hooks/use-toast";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "چطور قرآن را سریع‌تر حفظ کنم؟",
  "روش مرور روزانهٔ حفظ چیست؟",
  "یک انگیزهٔ قرآنی بده",
  "تجوید حروف حلقی را توضیح بده",
];

export default function ChatWidget() {
  const { user, openDialog } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, typing, open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 250);
  }, [open]);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || typing) return;

    // قفل پیام برای مهمان — تا لاگین نکند پیام نمی‌رود
    if (!user) {
      toast({
        title: "اول وارد شو",
        description: "تا وارد حساب نشوی، پیام به استاد ارسال نمی‌شود.",
        variant: "destructive",
      });
      openDialog();
      return;
    }

    const next: ChatMsg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setDraft("");
    setTyping(true);
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.slice(-12) }),
      });
      const data = (await r.json()) as { reply?: string; error?: string; needAuth?: boolean };
      if (r.status === 401) {
        toast({ title: "نشست منقضی شده", description: "دوباره وارد شو.", variant: "destructive" });
        openDialog();
        return;
      }
      if (!r.ok || !data.reply) {
        toast({ title: "پیام به استاد", description: data.error ?? "پاسخی نرسید.", variant: "destructive" });
        return;
      }
      setMessages((m) => [...m, { role: "assistant", content: data.reply as string }]);
    } catch {
      toast({ title: "ارتباط برقرار نشد", description: "اینترنت را چک کن و دوباره بفرست.", variant: "destructive" });
    } finally {
      setTyping(false);
    }
  };

  return (
    <>
      {/* دکمهٔ شناور */}
      <AnimatePresence>
        {!open && (
          <motion.button
            key="chat-fab"
            type="button"
            initial={{ opacity: 0, scale: 0.6, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.6, y: 16 }}
            onClick={() => setOpen(true)}
            aria-label="پیام به استاد تحفیظ"
            className="fixed bottom-4 right-4 z-40 flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-[oklch(0.8_0.13_85)] to-[oklch(0.62_0.12_82)] text-[oklch(0.2_0.04_80)] shadow-xl shadow-black/30 transition-transform hover:scale-105 sm:bottom-6 sm:right-6"
          >
            <MessageCircle className="size-6" aria-hidden="true" />
            <span
              className="absolute -top-0.5 -left-0.5 size-3 rounded-full bg-emerald-400 shadow"
              aria-hidden="true"
            />
          </motion.button>
        )}
      </AnimatePresence>

      {/* پنل گفتگو */}
      <AnimatePresence>
        {open && (
          <motion.section
            key="chat-panel"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            aria-label="گفتگو با استاد تحفیظ"
            className="glass-card gold-border-glow fixed bottom-4 right-4 z-50 flex h-[min(72svh,560px)] w-[min(400px,92vw)] flex-col overflow-hidden rounded-3xl shadow-2xl shadow-black/40 sm:bottom-6 sm:right-6"
          >
            {/* هدر */}
            <header className="flex items-center gap-3 border-b border-border/60 bg-background/40 px-4 py-3">
              <span className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl shadow ring-1 ring-gold/40">
                <Image
                  src="/logo.png"
                  alt="نشان استاد تحفیظ"
                  width={40}
                  height={40}
                  className="size-10 object-cover"
                />
              </span>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="text-sm font-black">استاد تحفیظ</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {user ? `همراه تو ای ${user.name || user.username} 🌿` : "مهمان — برای پیام دادن وارد شو"}
                </p>
              </div>
              {!user && (
                <Button size="sm" variant="outline" className="h-8 rounded-lg" onClick={() => openDialog()}>
                  <LogIn className="size-3.5" aria-hidden="true" />
                  ورود
                </Button>
              )}
              <Button
                size="icon"
                variant="ghost"
                className="size-8 rounded-lg"
                onClick={() => setOpen(false)}
                aria-label="بستن گفتگو"
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
            </header>

            {/* پیام‌ها */}
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" role="log" aria-live="polite">
              {messages.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                  <p className="max-w-[26ch] text-sm leading-relaxed text-muted-foreground">
                    سلام! من استاد تحفیضم 📖
                    <br />
                    دربارهٔ حفظ، مرور، تجوید و قرآن بپرس.
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => void send(s)}
                        className="rounded-full border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-gold/20"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    dir="auto"
                    className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      m.role === "user"
                        ? "rounded-br-md bg-gradient-to-l from-[oklch(0.8_0.13_85)] to-[oklch(0.68_0.12_82)] font-medium text-[oklch(0.2_0.04_80)]"
                        : "glass-card rounded-bl-md border-border/70"
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}

              {typing && (
                <div className="flex justify-start">
                  <div className="glass-card flex items-center gap-2 rounded-2xl rounded-bl-md border-border/70 px-3.5 py-2.5 text-sm text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                    استاد در حال نوشتن…
                  </div>
                </div>
              )}
            </div>

            {/* ورودی */}
            <form
              className="flex items-center gap-2 border-t border-border/60 bg-background/40 p-3"
              onSubmit={(e) => {
                e.preventDefault();
                void send(draft);
              }}
            >
              <Input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={user ? "پیامت را بنویس…" : "برای پیام دادن، اول وارد شو"}
                maxLength={500}
                disabled={typing}
                aria-label="متن پیام"
                className="h-10 flex-1 rounded-xl"
              />
              <Button
                type="submit"
                size="icon"
                disabled={typing || !draft.trim()}
                aria-label="ارسال پیام"
                className="size-10 shrink-0 rounded-xl bg-gradient-to-l from-[oklch(0.8_0.13_85)] to-[oklch(0.68_0.12_82)] text-[oklch(0.2_0.04_80)] shadow hover:brightness-110 disabled:opacity-40"
              >
                <SendHorizonal className="size-4" aria-hidden="true" />
              </Button>
            </form>
            <p className="pb-2 text-center text-[10px] text-muted-foreground">
              پاسخ‌ها با هوش مصنوعی تولید می‌شود
            </p>
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
}

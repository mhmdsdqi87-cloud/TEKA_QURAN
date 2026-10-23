"use client";

/**
 * دیالوگ ورود / ثبت‌نام حافظ — از استور auth باز و بسته می‌شود
 */
import { useEffect, useState } from "react";
import Image from "next/image";
import { LogIn, Loader2, UserPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-store";
import { useToast } from "@/hooks/use-toast";

type Mode = "login" | "register";

export default function AuthDialog() {
  const { dialogOpen, closeDialog, login, register, user } = useAuth();
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // وقتی کاربر وارد شد، دیالوگ بسته شود
  useEffect(() => {
    if (user) closeDialog();
  }, [user, closeDialog]);

  const submit = async () => {
    if (busy) return;
    setError("");
    setBusy(true);
    const res =
      mode === "login"
        ? await login(username.trim(), password)
        : await register(username.trim(), password, name.trim());
    setBusy(false);
    if (res.ok) {
      toast({
        title: mode === "login" ? "خوش آمدی 🌙" : "حسابت ساخته شد 🌙",
        description: "حالا می‌توانی تلاوت کنی و با استاد تحفیظ گفتگو کنی.",
      });
    } else {
      setError(res.error ?? "خطایی رخ داد");
    }
  };

  return (
    <Dialog
      open={dialogOpen}
      onOpenChange={(o) => {
        if (o) {
          setError("");
          setBusy(false);
        } else {
          closeDialog();
        }
      }}
    >
      <DialogContent className="glass-card gold-border-glow max-h-[92svh] max-w-[92vw] overflow-y-auto rounded-3xl border-border sm:max-w-md">
        <DialogHeader className="items-center text-center">
          <div className="relative mb-1 flex size-16 items-center justify-center overflow-hidden rounded-2xl shadow-lg ring-1 ring-gold/40">
            <Image
              src="/logo.png"
              alt="لوگوی حافظ"
              width={64}
              height={64}
              className="size-16 object-cover"
            />
          </div>
          <DialogTitle className="text-xl font-black">
            {mode === "login" ? "ورود به حافظ" : "ساخت حساب حافظ"}
          </DialogTitle>
          <DialogDescription className="leading-relaxed">
            برای تلاوت، ذخیرهٔ آمار و «پیام به استاد» باید وارد شوی — آمار تو همیشه محفوظ می‌ماند.
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {mode === "register" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="auth-name">نام نمایشی (اختیاری)</Label>
              <Input
                id="auth-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثلاً: محمد"
                maxLength={40}
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="auth-username">نام کاربری</Label>
            <Input
              id="auth-username"
              dir="ltr"
              className="text-left"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="username"
              autoCapitalize="none"
              autoComplete="username"
              required
              maxLength={20}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="auth-password">رمز عبور</Label>
            <Input
              id="auth-password"
              dir="ltr"
              className="text-left"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
            />
          </div>

          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive" role="alert">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={busy || !username.trim() || !password}
            className="mt-1 h-11 bg-gradient-to-l from-[oklch(0.8_0.13_85)] to-[oklch(0.68_0.12_82)] font-bold text-[oklch(0.2_0.04_80)] shadow-md hover:brightness-110"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : mode === "login" ? (
              <LogIn className="size-4" aria-hidden="true" />
            ) : (
              <UserPlus className="size-4" aria-hidden="true" />
            )}
            {busy ? "کمی صبر…" : mode === "login" ? "ورود" : "ثبت‌نام و ورود"}
          </Button>
        </form>

        <div className="text-center text-sm">
          {mode === "login" ? (
            <button
              type="button"
              className="font-medium text-gold underline-offset-4 hover:underline"
              onClick={() => {
                setMode("register");
                setError("");
              }}
            >
              حساب نداری؟ ثبت‌نام کن
            </button>
          ) : (
            <button
              type="button"
              className="font-medium text-gold underline-offset-4 hover:underline"
              onClick={() => {
                setMode("login");
                setError("");
              }}
            >
              حساب داری؟ وارد شو
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { Heart } from "lucide-react";

export default function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-gold/15 bg-card/60 py-4 backdrop-blur-md">
      <div
        className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 pb-[env(safe-area-inset-bottom)] text-center sm:flex-row sm:px-6"
      >
        <p className="font-quran text-sm text-gold/90">
          وَلَقَدْ يَسَّرْنَا ٱلْقُرْءَانَ لِلذِّكْرِ ۖ فَهَلْ مِن مُّدَّكِرٍ
        </p>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          ساخته شده توسط گروه
          <span className="rounded-lg border border-gold/40 bg-gold/10 px-2 py-0.5 text-sm font-black tracking-wider text-gold">
            TEKA
          </span>
          <Heart className="size-3.5 fill-red-500 text-red-500" aria-hidden="true" />
        </p>
      </div>
    </footer>
  );
}

# Worklog — «حافظ» تحفیظ قرآن با هوش مصنوعی (TEKA)

---
Task ID: 1
Agent: main (Z.ai Code)
Task: راه‌اندازی، بررسی ساختار پروژه و برنامه‌ریزی

Work Log:
- بررسی ساختار پروژه: Next.js 16 + TS + Tailwind 4 + shadcn/ui کامل + Prisma/SQLite + framer-motion + zustand
- مطالعه SKILL.md برای ASR و LLM (z-ai-web-dev-sdk، فقط بک‌اند)
- برنامه: دانلود کل قرآن → API → موتور ضبط/تطبیق → UI قرآنی RTL

Stage Summary:
- چیدمان تسک‌ها انجام شد. مهارت‌ها بارگذاری شدند.

---
Task ID: 7
Agent: frontend-styling-expert
Task: Hero 3D Kaaba animation + floating verses background scaffolding

Work Log:
- مطالعهٔ worklog.md، globals.css، layout.tsx و page.tsx؛ بررسی نسخهٔ lucide-react (^0.525) و framer-motion (^12.23) و alias «@/*»
- ساخت src/app/hero.css: صحنهٔ سه‌بعدی کعبه با --kaaba-size واکنش‌گرا clamp(180px, 30vw, 300px)؛ مکعب preserve-3d با ۶ وجه (rotateY/rotateX + translateZ)، وجه‌های مات سیاه (گرادیان شعاعی #101010→#000)، نوار طلایی حجر اسماعیل روی جلو/عقب (::after)، درِ طلایی روی وجه جلو (::before)، rim-light طلایی ملایم (inset box-shadow)، میدان ستاره (کلاس kaaba-star با twinkle و متغیرهای --o-min/--o-max)، هالهٔ بیضوی طواف زیر کعبه (kaaba-orbit-glow با blur و pulse)، شناوری آرام (kaaba-idle-float: translateY + rotateY تنفسی)، نور طوافِ دوران‌کننده (kaaba-tawaf + kaaba-tawaf-light با rotateY 360deg، خلاف جهت عقربه از بالا)، انیمیشن پرتاب kaaba-launch (scale 2.4 + dolly پرسپکتیو + burst طلایی ::after + چرخش ۴۲ درجهٔ مکعب، 1.15s cubic-bezier)؛ همهٔ انیمیشن‌های بی‌پایان زیر prefers-reduced-motion: reduce غیرفعال + کلاس‌های کمکی مستقل از تم (hero-gold-text، hero-soft، hero-softer، hero-hr-gold)
- ساخت src/components/kaaba-animation.tsx («use client»): رندر scene > stars (۲۸ ستاره با PRNG دانه‌دار mulberry32 برای جلوگیری از hydration mismatch + useMemo) > orbit-glow > float > cube با ۶ وجه + نور طواف؛ کلاس kaaba-launch فقط وقتی launch=true (با false حذف می‌شود)؛ role="img" و aria-label="کعبه معظمه"؛ صادرات default و named
- ساخت src/components/hero-section.tsx («use client»، default export): سکشن min-h-[100svh] با پس‌زمینهٔ شب مستقل از تم (oklch 0.17→0.1 + هالهٔ طلایی مرکز-پایین)؛ composition مرکزی RTL: بسم‌الله (font-quran + text-glow-gold)، عنوان «حـافـظ» گرادیان طلایی→زمردی با clamp، زیرعنوان، کعبه، دکمهٔ CTA طلایی گرادیانی با آیکون Mic (روی کلیک: launch=true سپس setTimeout(onStart, 950)؛ در حال پرتاب: disable + متن «…به سمت استودیو»)، لینک ghost «مشاهدهٔ امکانات» به #features با ChevronDown بی‌نهایت-جهش؛ ورود پلکانی با framer-motion (stagger 0.12، initial opacity 0 / y 24)؛ overflow-hidden برای جلوگیری از اسکرول افقی؛ کامنت جایگذاری FloatingVerses (توسط عامل دیگر/صفحه لایه‌بندی می‌شود)
- بررسی TypeScript با tsc --noEmit: بدون خطا در src/** (فقط خطاهای ازپیش‌موجود در examples/ و skills/)
- هیچ فایل موجودی تغییر نکرد (globals.css، layout.tsx، page.tsx دست‌نخورده)

Stage Summary:
- فایل‌های ساخته‌شده:
  1. src/app/hero.css — استایل‌های صحنهٔ سه‌بعدی کعبه + انیمیشن‌ها (import در hero-section.tsx)
  2. src/components/kaaba-animation.tsx — export default KaabaAnimation + named export؛ props: { launch?: boolean; className?: string }
  3. src/components/hero-section.tsx — export default HeroSection؛ props: { onStart: () => void }
- قرارداد props برای عامل اصلی: صفحه باید <HeroSection onStart={...} /> را رندر کند (مثلاً انتقال به استودیو با router.push)؛ FloatingVerses جداگانه پشت/اطراف HeroSection لایه‌بندی شود؛ سکشن «امکانات» باید id="features" داشته باشد؛ کلاس kaaba-launch به‌صورت خودکار با پراپ launch کنترل می‌شود

---
Task ID: 5
Agent: main (Z.ai Code)
Task: بک‌اند کامل — داده، دیتابیس، APIها، موتور تطبیق

Work Log:
- دانلود کل قرآن (عثمانی + ترجمهٔ فارسی makarem) از alquran.cloud → ادغام در data/quran.json (114 سوره، 6236 آیه، 3MB؛ f: شماره آیه، g: شماره جهانی برای CDN صوت، t: عثمانی، fa: ترجمه)
- prisma/schema.prisma: مدل Session (accuracy, mistakes JSON...) + db push موفق
- src/lib/quran-data.ts: لودر fs با کش سراسری (getSurahList/getSurah/getRandomAyahs)
- src/lib/alignment.ts: نرمال‌سازی عربی (اعراب/الف/ی/ه)، لوانشتاین، هم‌ترازی DP روی پنجره + پنجرهٔ عقب‌رو برای تکرار آیه؛ وضعیت کلمه: pending/active/correct/wrong/missed؛ computeAccuracy
- src/lib/recorder.ts + public/worklets/recorder-worklet.js: ضبط AudioWorklet→WAV 16kHz هر ۶ ثانیه با فیلتر سکوت (RMS) + فالبک ScriptProcessor + listMicrophones
- src/lib/store.ts: zustand استودیو (setRange/applyHeard/finish...) با تولید بازخورد لحظه‌ای فارسی
- API: /api/quran (force-static)، /api/quran/[surah]?from&to، /api/asr (zai.audio.asr)، /api/analyze (LLM معلم قرآن، JSON سخت‌گیرانه با فالبک ایمن)، /api/sessions (GET/POST)، /api/stats (میانگین، streak، bySurah، trend)

Stage Summary:
- بک‌اند کامل و آمادهٔ اتصال؛ قرارداد: POST /api/asr {audio: base64Wav} → {text}؛ alignSegment(track,pos,heard) هستهٔ لحظه‌ای است

---
Task ID: 6,8,9,10 (iteration 2)
Agent: main (Z.ai Code)
Task: درخواست دوم کاربر — اسپلش ۸ ثانیه‌ای، پس‌زمینهٔ کعبهٔ واقعی، آمار شخصی واقعی، دقت تحفیظ

Work Log:
- رفع باگ‌های کشف‌شده در E2E: (۱) وضعیت active مانع ثبت missed می‌شد → حذف active از track نهایی (نمایشی شد)، (۲) هزینهٔ DP اصلاح شد (delete 0.8 / fuzzy 0.85) تا جاافتادگی واقعی detect شود، (۳) خطای Runtime در store (normalizeArabic بدون import در هوک دیباگ)
- موتور تشخیص: ASR سروری عربی را ضعیف تشخیص داد → Web Speech API (ar-SA) موتور اصلی زنده + فالبک قطعه‌ای سروری؛ applyPreview برای هایلایت لحظه‌ای interim
- splash-screen.tsx: اسپلش ۸ ثانیه‌ای با ۴ آیهٔ سنگین (Hجر/ص/قمر/شرح)، فید blur+scale، نوار پیشرفت، دکمهٔ رد کردن، قفل اسکرول
- تصویر کعبهٔ سینمایی با AI تولید و در هیرو جایگزین کیوب ۳بعدی شد (درخواست کاربر: بدون ۳بعدی)؛ وینیت تیرهٔ مرکزی برای خوانایی + زوم-اوت هنگام CTA
- آمار واقعی: ستون userId در Prisma (db push --force-reset)؛ uid از localStorage؛ /api/sessions و /api/stats فیلتر بر uid؛ رویداد hafez:session-saved برای تازه‌سازی زندهٔ StatsPanel؛ کارت‌های جدید: آیات امروز، تلاوت بی‌نقص + نمودار فعالیت ۱۴ روزه
- استودیو: شمارش معکوس ۳-۲-۱ با عدد قرآنی درخشان، word-pop انیمیشن کلمات درست، ثبت جلسه با uid
- راستی‌آزمایی کامل مرورگر: اسپلش→هیرو→استودیو→تلاوت شبیه‌سازی‌شده (missed دقیق detect شد، دقت ۹۶.۶٪)→تحلیل LLM→ذخیره→آمار شخصی (sessions=1, todayAyat=7, avg=96.6)→نشان‌ها→نمودارها→موبایل→فوتر TEKA

Stage Summary:
- همهٔ درخواست‌های دور دوم پیاده و راستی‌آزمایی شد؛ lint و tsc پاک؛ dev.log بدون خطا

---
Task ID: 11 (iteration 3)
Agent: main (Z.ai Code)
Task: درخواست سوم کاربر — دقت AI خیلی بالا + بوق لحظه‌ای خطا + اپشن‌های فراوان + اسپلش ۱۳ ثانیه‌ای به‌عنوان اولین چیز

Work Log:
- باگ ریشه‌ای دقت کشف و رفع شد: نرمال‌ساز الف خنجی (ٰ U+0670) را حذف می‌کرد → «ٱلْعَٰلَمِينَ» به «العلمین» نرمال می‌شد در حالی که ASR/کاربر «العالمین» می‌گوید → تطبیق fuzzy گران (0.85) به‌جای exact (0) → مسیر delete+match در DP می‌باخت و جاافتادگی به اشتباه «wrong» می‌شد. رفع: ٰ→ا، ۥ→و، ۦ→ي + جدول CANON (الرحمان→الرحمن، صلاوة→صلاة، الحيوة→الحياة، زكوة→زكاة، هاذا→هذا، ...)
- تست‌های bun: تلاوت کامل درست با املای متداول = ۱۰۰٪؛ جاافتادگی «رب» → missed دقیق؛ حالت سخت‌گیر exact=4؛ همه پاس
- SpeechEngine: maxAlternatives=3 و ارسال همهٔ گزینه‌های جایگزین ASR به onFinal
- store.applyHeard: انتخاب بهترین کاندید بین متن اصلی + جایگزین‌ها (clone track برای هر کاندید، scoreOf = quality + exact bonus + progress bonus)؛ دروازهٔ ghostPreview از تنظیمات؛ سخت‌گیری از STRICTNESS_PRESETS در alignSegment و applyPreview
- src/lib/sfx.ts: موتور صدای WebAudio (بدون فایل) — بوق خطای دو-تن نزولی، بوق جاافتادگی، آرپژ تشویق، تیک شمارش معکوس، تُن شروع، فانفار پایان، vibrate
- src/lib/settings.ts: استور zustand + persist (localStorage «hafez-settings-v1») با ۱۳ گزینه: sounds, errorAlert(all/beep/vibrate/silent), volume, strictness, liveFeedback, praise, autoScroll, autoStop, ghostPreview, hideUpcoming, countdown, textSize
- recitation-studio: پنل «تنظیمات پیشرفته» (Collapsible با ۴ بخش: صدا و هشدار / دقت تشخیص / نمایش و متن / جلسه)، هشدار لحظه‌ای خطا (بوق+لرزش+توست+فلاش سرخ دور متن زنده)، بوق شمارش معکوس، unlockAudio، عبور alts، توقف خودکار gate، کش sessionStorage فهرست سوره‌ها از اسپلش، throttle پیش‌نمایش 160→100ms
- live-ayah-view: حالت «تمرین کور» (word-veiled: blur کلمات پیش‌رو تا از حفظ بخوانی + بنر توضیح)، اندازهٔ متن sm/md/lg، پیمایش خودکار gate
- splash-screen: ۱۳ ثانیه، ۶ آیهٔ سنگین (الحجر، آیةالکرسی، ص، الرعد، القمر، الشرح)، useState(true) → اولین رندر صفحه، درصد پیشرفت فارسی، پیش‌بارگذاری واقعی /api/quran هنگام اسپلش + sessionStorage cache
- globals.css: .error-flash (فلاش سرخ 0.85s) و .word-veiled (blur+opacity)
- راستی‌آزمایی مرورگر E2E: اسپلش اولین چیز (~14s با exit) → شبیه‌سازی تلاوت: missed:رب + wrong:واياك، دقت ۹۳.۱٪ → autoStop → کارت نظر معلم LLM (نکتهٔ اصلاحی اختصاصی برای يايك) → ذخیره → آمار واقعی sessions=2, avg=91.4=(89.7+93.1)/2 → تمرین کور: ۲۵ کلمهٔ محو/بنر/خاموش‌کردن → موبایل 390px تمیز → صفر خطای کنسول پس از reload تازه

Stage Summary:
- هستهٔ تطبیق اکنون جاافتادگی را با املای واقعی ASR هم دقیق detect می‌کند (باگ الف خنجی رفع شد)؛ بوق/لرزش/توست/فلاش خطا همان لحظه؛ ۱۳ تنظیم ماندگار؛ اسپلش ۱۳ث اولین صفحه با prewarm واقعی داده؛ lint و tsc پاک

---
Task ID: 12 (iteration 4)
Agent: main (Z.ai Code)
Task: درخواست چهارم کاربر — سیستم لاگین (قفل پیام تا ورود)، کامیت با اسم mohammad، پوش به GitHub (TEKA_QURAN)، دیپلوی Vercel

Work Log:
- Prisma: مدل User (username unique، passwordHash scrypt، name) + AuthToken (توکن ۳۰روزه، Cascade) اضافه شد؛ Session بدون FK ماند تا uidهای محلی قدیمی هم معتبر بمانند؛ db push موفق
- src/lib/db.ts: resolveDatabaseUrl (روی Vercel → file:/tmp/hafez.db) + ensureSchema() با CREATE TABLE IF NOT EXISTS برای شروع سرد serverless
- src/lib/auth.ts: scrypt hash/verify، توکن 32بایتی، کوکی httpOnly «hafez_session» (30روز، secure در production)، getAuthUser()، validateCredentials
- API: /api/auth/register (409 تکراری)، /api/auth/login (401 غلط)، /api/auth/logout، /api/auth/me — همه تست‌شده با curl ✓
- /api/chat «پیام به استاد»: 401 برای مهمان (needAuth)، پرامپت استاد تحفیظ (قرآن/حفظ/تجوید/انگیزه، فارسی، ارجاع آیه)، تاریخچه ۱۲ پیام، zai.chat.completions — پاسخ فارسی با آیه ✓
- /api/sessions POST: فقط کاربر واردشده (401) و userId از کوکی؛ GET و /api/stats: اگر لاگین بود uid حساب وگرنه uid محلی؛ ensureSchema در همه
- src/lib/auth-store.ts (zustand): user/ready/dialogOpen + login/register/logout/refresh
- auth-dialog.tsx: تب ورود/ثبت‌نام، اعتبارسنجی، خطا، توست خوش‌آمد؛ site-header: چیپ کاربر (حرف اول + خروج) یا دکمه «ورود / ثبت‌نام»
- قفل‌ها: استودیو startRecording (توست + دیالوگ)، چت send، ذخیره جلسه — همه فقط با لاگین؛ stats-panel بنر دعوت به ورود برای مهمان + uid حساب پس از ورود
- chat-widget.tsx: FAB طلایی + پنل شیشه‌ای (سربرگ استاد، پیام‌ها، پیشنهادهای سریع، typing، ارسال با Enter)؛ جابجایی به bottom-right به‌دلیل تداخل با nextjs-portal
- ورکل: build = prisma generate && next build + postinstall؛ outputFileTracingIncludes برای data/quran.json؛ .gitignore+db/*.db؛ README «TEKA_QURAN»
- E2E مرورگر: اسپلش اول؛ ثبت‌نام «محمد» از دیالوگ → چیپ هدر؛ چت مهمان → قفل + دیالوگ؛ چت لاگین → پاسخ LLM؛ استودیو لاگین → phase=recording؛ خروج؛ استودیو مهمان → بلاک + دیالوگ؛ curl: 401/409 ها ✓؛ موبایل 390px تمیز؛ صفر خطای کنسول
- نکته تست: کلیک agent-browser روی دکمه سوییچ تب دیالوگ به‌خاطر توست پوشیده می‌شد (artifact ابزار، نه باگ)؛ با eval click سالم بود

Stage Summary:
- سیستم حساب کاربری کامل و قفل «پیام تا لاگین» روی چت/تلاوت/ذخیره اعمال و راستی‌آزمایی شد؛ آمادهٔ پوش GitHub و دیپلوی Vercel

---
Task ID: 13 (iteration 4 — deploy)
Agent: main (Z.ai Code)
Task: گیت + ورکل

Work Log:
- git init تازه (تاریخچهٔ قبلی حذف شد طبق دستور کاربر)، user.name=mohammad / email=noreply، ۱۳۶ فایل استیج شد (بدون .env و db/*.db و لاگ‌ها — چک حساسیت ✓)
- commit «first commit» با نویسندهٔ mohammad ✓ → push -u origin main با credential helper موقتی (توکن در config ذخیره نشد) → https://github.com/mhmdsdqi87-cloud/TEKA_QURAN ✓
- vercel link (project: teka-quran) + env DATABASE_URL=file:/tmp/hafez.db (Production) → vercel --prod → https://teka-quran.vercel.app (Ready in 1m) ✓
- راستی‌آزمایی production: / 200، /api/quran کامل، register موفق، چت مهمان 401، stats graceful، اسپلش ۱۳ث اول صفحه، استودیو/چت/هدر سالم، صفر خطای کنسول

Stage Summary:
- سایت لایو: https://teka-quran.vercel.app | ریپو: https://github.com/mhmdsdqi87-cloud/TEKA_QURAN
- محدودیت: SQLite روی ورکل موقتی است (با cold start ریست می‌شود) — برای دائمی شدن: Turso/Neon
- توکن‌ها فقط در همین نشست استفاده شدند و در هیچ فایلی ذخیره نشدند؛ توصیه: چرخاندن (revoke) هر دو توکن پس از این مرحله

---
Task ID: 14 (iteration 5)
Agent: main (Z.ai Code)
Task: درخواست پنجم کاربر — اتصال Turso، رفع خرابی ورود/ثبت‌نام، معلم تحفیظ واقعی‌تر و قوی‌تر

Work Log:
- ریشه‌یابی باگ «گزینه‌های ورود و ثبت‌نام تشکیل نمی‌شوند»: کلاس سفارشی gold-border-glow با position:relative بیرون از cascade layer تعریف شده بود و بر position:fixed ابزار Tailwind (در @layer utilities) اولویت می‌گرفت → DialogContent و پنل چت به‌جای fixed در جریان سند رندر و از دید خارج می‌شدند. ریشه‌یابی با getComputedStyle (position:relative, top:2251px) اثبات شد.
- رفع: انتقال .gold-border-glow به @layer components در globals.css (برای کارت‌های معمولی relative می‌ماند، برای fixed/absolute ابزار برنده می‌شود) + محکم‌کاری دیالوگ با max-h-[92svh] overflow-y-auto
- Turso: نصب @libsql/client + @prisma/adapter-libsql@6.11.1 (نسخهٔ هماهنگ)؛ db.ts با درایور ادبتر وقتی TURSO_DATABASE_URL+TURSO_AUTH_TOKEN ست باشند، فالبک امن به SQLite محلی؛ scripts/turso-migrate.ts (اسکیما + کپی idempotent User/AuthToken/Session) و scripts/driver-smoke.ts
- توکن ارسالی کاربر توکن پلتفرم بود (org_id) → با API پلتفرم تورسو (api.turso.tech) توکن دیتابیس برای tekaquran ساخته شد؛ مهاجرت واقعی: ۲ کاربر/۱ توکن/۳ جلسه کپی شد
- معلم تحفیظ: src/lib/teacher.ts — استخراج پروفایل واقعی (جلسات، میانگین/بهترین دقت، استریک، سوره‌های ضعیف/قوی، خطاهای اخیر از mistakes JSON، جلسهٔ آخر)؛ /api/chat با پرامپت ۴ حوزهٔ تخصص + پروفایل + thinking enabled؛ /api/analyze با پروفایل + خروجی جدید grade و plan؛ کارت «نظر معلم»: چیپ نمرهٔ رنگی + بخش «برنامهٔ تمرین معلم»
- UX ورود: دکمهٔ «ورود / ثبت‌نام» در هیرو برای مهمان‌ها
- E2E محلی: ثبت‌نام از دیالوگ (کلیک فیزیکی سوییچ تب سالم)، کاربر مستقیماً در Turso ساخته شد، چت با نام کاربر و برنامهٔ هفتگی جواب داد، جلسهٔ شبیه‌سازی‌شده → کارت نظر (نمرهٔ «خوب» + برنامهٔ تمرین) + ذخیره در Turso
- دیپلوی: rebase روی README.md ویرایش‌شدهٔ خود کاربر در گیت‌هاب، پوش با نام mohammad → https://github.com/mhmdsdqi87-cloud/TEKA_QURAN ; envهای TURSO_DATABASE_URL/TURSO_AUTH_TOKEN روی Production+Preview ورکل؛ دیپلوی → https://teka-quran.vercel.app
- راستی‌آزمایی production: ثبت‌نام → رکورد در Turso ابری ✓، لاگین مجدد ✓، موبایل ۳۹۰px دیالوگ fixed و داخل صفحه ✓، صفر خطای کنسول ✓؛ کاربران آزمایشی پاک شدند

Stage Summary:
- دیتابیس اکنون پایدار است (حساب‌ها و آمار با cold-start ورکل پاک نمی‌شوند)؛ باگ ریشه‌ای دیالوگ/چت رفع شد؛ استاد چت و تحلیل شخصی‌سازی‌شده و قوی‌تر شد؛ lint/tsc پاک
- امنیت: توکن پلتفرم تورسو + PAT گیت‌هاب + توکن ورکل در چت مطرح شده‌اند → به کاربر توصیهٔ چرخاندن هر سه توکن

---
Task ID: 15
Agent: main (Z.ai Code)
Task: درخواست سوم کاربر — لوگوی قرآنی (favicon + هدر)، رفع خرابی «استاد تحفیظ» روی سایت لایو، دقت بیشتر استودیو تلاوت

Work Log:
- مهاجرت واقعی Turso اجرا شد (scripts/turso-migrate.ts): اتصال برقرار، اسکیمای ابری آماده، داده‌های محلی روی ابر موجود
- ریشه‌یابی «معلم خرابه/در دسترس نیست»: z-ai-web-dev-sdk از فایل /etc/.z-ai-config (فقط در سندباکس) پیکربندی می‌خواند؛ روی Vercel همیشه throw می‌کرد → خطای ۵۰۲ «استاد فعلاً در دسترس نیست»
- ساخت src/lib/llm.ts — زنجیرهٔ تأمین LLM: (۱) z-ai SDK با thinking در سندباکس (۲) فالبک خودکار Pollinations (OpenAI-compatible، بدون کلید، تست‌شده از هر سرور). مسیرهای /api/chat و /api/analyze متصل شدند
- تست لایو: چت استاد روی teka-quran.vercel.app جواب شخصی‌سازی‌شدهٔ فارسی با آیه و «گام عملی» داد (پروفایل از Turso)؛ ثبت‌نام/ورود با چند کانکشن سرد → حساب پایدار (رفع کامل «حساب‌ها پاک می‌شوند»)
- دقت استودیو: maxAlternatives ۳→۵، حالت سازگار iOS Safari (continuous=false + بازراه‌اندازی بعد هر نتیجهٔ نهایی با تأخیر ۱۲۰ms)، تشخیص iPadOS
- src/lib/alignment.ts: alignSegment پارامتر fullWindow گرفت + تابع fullResweep — هم‌ترازی سراسری «کل شنیده‌ها با کل بازه» در پایان جلسه؛ خطاهای انباشتهٔ هم‌ترازی لحظه‌ای اصلاح می‌شود (سقف ایمنی ۲.۵ میلیون سلول DP)
- store.ts: finish() حالا resweep سراسری را اجرا و آمار/accuracy/pos را به‌روزرسانی می‌کند + پیام «بازبینی نهایی انجام شد»
- لوگو با image-generation ساخته شد (کتاب طلایی نورانی + هلال روی زمردی، بدون متن): public/logo.png (هدر/چت/دیالوگ)، public/logo-circle.png، src/app/icon.png (favicon کنار آدرس مرورگر — link rel=icon تأیید شد)، src/app/apple-icon.png، public/logo-ornate.png (نسخهٔ شکیل‌تر برای استفاده‌های بعدی)
- site-header.tsx، chat-widget.tsx و auth-dialog.tsx به لوگوی واقعی مجهز شدند (next/image + ring طلایی)
- E2E با agent-browser: اسپلش → هدر با لوگو → ثبت‌نام/ورود (دسکتاپ + موبایل ۳۹۰px) → چت استاد با پاسخ واقعی → موتور تطبیق (تلاوت کامل=۱۰۰٪، جاافتادگی+کلمهٔ اشتباه=۸۰٪ با تشخیص درست، resweep پایانی) → فوتر چسبندهٔ TEKA
- lint و tsc روی src/ بدون خطا؛ commit c49dabd با author «mohammad» → push به main → deploy تولیدی Vercel dpl_DuxFDUDyEFDErCXStwxJiDHd4Vnu → READY
- متغیرهای محیطی TURSO_DATABASE_URL و TURSO_AUTH_TOKEN روی Vercel (production/preview/development) تنظیم شدند (via REST API)

Stage Summary:
- زنجیرهٔ LLM تضمین می‌کند استاد تحفیظ روی هر هاستی وصل بماند؛ برای کیفیت بهتر در آینده کافی است متغیر زایمثل OPENAI_API_KEY به llm.ts اضافه شود
- حساب آزمایشی live_qa_test روی Turso باقی مانده (بی‌خطر)؛ توکن‌های به‌اشتراک‌گذاشته‌شده (GitHub/Vercel/Turso) باید توسط کاربر چرخانده شوند
---
Task ID: 16
Agent: main (Z.ai Code)
Task: گزارش کاربر — «استودیو در اندروید کلاً قاطی‌پاتی می‌شود و همه‌چی را اشتباه می‌گیرد»

Work Log:
- ریشه‌یابی ۵ باگ اندروید:
  (۱) باگ بحرانی resultIndex در کروم اندروید: resultIndex اغلب صفر برمی‌گردد → همهٔ نتایج نهایی قبلی در هر رویداد دوباره پردازش می‌شدند → همان متن چندبار در موقعیت‌های پیش‌رونده اعمال → خطای کاذب wrong/inserted آبشاری → «همه‌چی اشتباه» + سیل بازخورد = «قاطی‌پاتی»
  (۲) مرگ خاموش موتور: اگر start() هنگام بازراه‌اندازی exception می‌داد (میکروفون اشغال)، موتور برای همیشه می‌مرد (onend دیگر نمی‌آمد)
  (۳) قطعه‌های کوتاه اندرویدی (هر مکث یک final): یک کلمهٔ پرتکرار مثل «الله» می‌توانست pos را چندکلمه جلو بپراند و کل ادامه را ناهم‌تراز کند
  (۴) حذف «ال» توسط ASR گوگل: «الناس» vs «ناس» شباهت ۰.۵ → کلمهٔ درست غلط شمرده می‌شد
  (۵) بدون wake-lock/watchdog/سقف بازخورد
- speech.ts بازنویسی کامل: دفتر ضدتکرار per-session (Set از اندیس نتایج نهایی پردازش‌شده)، backoff نمایی بازراه‌اندازی [۲۵۰ms→۴s]، تشخیص طوفان aborted، start idempotent، onstart برای تأیید حیات، onStateChange
- alignment.ts: محافظ ضدپرش (خشک‌پیمایی قبل از جهش: پرش > طول قطعه+۴ با <۲ تطبیق = رد)، اولویت پنجرهٔ عقب‌رو برای تکرار آیه (backMatches≥3 && backMatches>fwdMatches)، wordSimilarity با stripEl (وال/فال/بال/كال/لل/ال) و تطبیق containment، اصلاح CANON به فرم‌های پس از نرمال‌سازی (کلیدهای قبلی با ؛ هرگز مچ نمی‌شدند)
- store.ts: سقف ۶۰ پیام بازخورد + ضدتکرار لایهٔ دوم (همان متن <۸۰۰ms)
- recitation-studio.tsx: watchdog هر ۳ ثانیه (اگر اندروید موتور را کشت زنده می‌شود، تا ۲۰ بار)، wake-lock (صفحه هنگام تلاوت خاموش نشود)، throttle پیش‌نمایش ۲۲۰ms روی لمسی (۱۰۰ms دسکتاپ)
- تست شبیه‌سازی ۷ سناریوی اندرویدی: ۱۴/۱۴ موفق (تلاوت کامل، قطعهٔ کوتاه مبهم، حذف ال، تکرار نتیجهٔ نهایی، خطای واقعی، resweep، قطعه‌های کوتاه پیوسته)
- E2E موبایل ۳۹۰px با agent-browser: انتخاب فاتحه → ۲۹ کلمه → شبیه‌سازی ۷ قطعه + تکرار باگ اندروید → تکرار حذف شد (heardCount=۶ از ۷)، pos=۲۹/۲۹، دقت ۱۰۰٪، صفر wrong → کارت بازبینی با نمرهٔ «خوب» + برنامهٔ تمرین معلم → /api/analyze ۲۰۰ → lint و tsc پاک
- commit 17b7ba2 با نام mohammad → push به main → deploy خودکار Vercel

Stage Summary:
- استودیو برای اندروید مقاوم شد: ضدتکرار نتایج (ریشهٔ «همه‌چی اشتباه»)، ضدپرش pos، احیای خودکار موتور، جلوگیری از خاموشی صفحه، مهار سیل بازخورد
- توصیهٔ کاربردی برای کاربر: در گوشی اندروید از Chrome استفاده شود؛ تلاوت در محیط کم‌سروصدا و بدون پخش صدای پس‌زمینه دقت بیشتری دارد

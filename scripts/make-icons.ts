/**
 * ساخت آیکون‌های PWA از لوگوی حافظ
 * - icon-192.png / icon-512.png (نرمال)
 * - icon-maskable-192.png / icon-maskable-512.png (با حاشیهٔ امن ۱۰٪ روی زمینهٔ سبز تیره)
 */
import sharp from "sharp";
import fs from "fs";
import path from "path";

const SRC = path.join(process.cwd(), "public", "logo.png");
const OUT = (name: string) => path.join(process.cwd(), "public", name);

// رنگ پس‌زمینهٔ برند (همان سبز تیرهٔ تم): oklch تقریبی → hex #0c1f1a
const BG = "#0c1f1a";

async function make(size: number, out: string, maskable: boolean) {
  const pad = maskable ? Math.round(size * 0.12) : 0;
  const inner = size - pad * 2;
  const img = await sharp(SRC)
    .resize(inner, inner, { fit: "contain", background: { r: 12, g: 31, b: 26, alpha: 0 } })
    .png()
    .toBuffer();
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 12, g: 31, b: 26, alpha: maskable ? 1 : 0 },
    },
  })
    .composite([{ input: img, left: pad, top: pad }])
    .png()
    .toFile(OUT(out));
  console.log(`✓ ${out} (${size}×${size}${maskable ? " maskable" : ""})`);
}

const meta = await sharp(SRC).metadata();
console.log(`لوگوی مبدأ: ${meta.width}×${meta.height}`);

await make(192, "icon-192.png", false);
await make(512, "icon-512.png", false);
await make(192, "icon-maskable-192.png", true);
await make(512, "icon-maskable-512.png", true);
console.log("تمام شد.");

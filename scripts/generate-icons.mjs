// scripts/generate-icons.mjs
// Genera tutti i raster favicon/PWA dai due SVG sorgente in public/brand/.
// Single-source: gli SVG sono l'unica geometria; questi output sono derivati.
// Uso (2-3 volte l'anno, quando ritocchi gli SVG):
//   npm i -D sharp png-to-ico
//   node scripts/generate-icons.mjs
// I PNG/ICO prodotti vanno committati come file statici.
// sharp NON resta in dipendenza di runtime: è solo devDependency locale.

import sharp from "sharp";
import pngToIco from "png-to-ico";
import { readFile, writeFile, copyFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const FAVICON_SVG = "public/brand/meetoo-favicon.svg";
const MASKABLE_SVG = "public/brand/meetoo-maskable.svg";

// Rasterizza un SVG a PNG quadrato della dimensione data.
async function svgToPng(svgPath, size, outPath) {
  await mkdir(dirname(outPath), { recursive: true });
  const svg = await readFile(svgPath);
  await sharp(svg, { density: 384 }) // density alta = bordi netti sui cerchi
    .resize(size, size)
    .png()
    .toFile(outPath);
  console.log(`  ${outPath}  (${size}x${size})`);
}

async function main() {
  console.log("→ Tab / iOS (da meetoo-favicon.svg):");
  // icon.svg: copia diretta, nessuna conversione (browser moderni)
  await mkdir("app", { recursive: true });
  await copyFile(FAVICON_SVG, "app/icon.svg");
  console.log("  app/icon.svg  (copia SVG)");
  // apple-icon: PNG 180x180 esatti (iOS non supporta SVG)
  await svgToPng(FAVICON_SVG, 180, "app/apple-icon.png");
  // favicon.ico multi-size 16/32/48 da PNG intermedi
  const icoBuffers = await Promise.all(
    [16, 32, 48].map(async (s) =>
      sharp(await readFile(FAVICON_SVG), { density: 384 })
        .resize(s, s)
        .png()
        .toBuffer()
    )
  );
  await writeFile("app/favicon.ico", await pngToIco(icoBuffers));
  console.log("  app/favicon.ico  (16/32/48 multi-size)");

  console.log("→ PWA any (da meetoo-favicon.svg):");
  await svgToPng(FAVICON_SVG, 192, "public/icon-192.png");
  await svgToPng(FAVICON_SVG, 512, "public/icon-512.png");

  console.log("→ PWA maskable (da meetoo-maskable.svg):");
  await svgToPng(MASKABLE_SVG, 192, "public/icon-maskable-192.png");
  await svgToPng(MASKABLE_SVG, 512, "public/icon-maskable-512.png");

  console.log("\n✓ Fatto. Ricorda: committa i file generati (app/ + public/).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

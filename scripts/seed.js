#!/usr/bin/env node
// Seed the initial 8 demo trips + their cover images.
// Runs automatically on app start when SEED_ON_START=true and trips table is empty.
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import postgres from "postgres";
import sharp from "sharp";

const UPLOADS = process.env.UPLOADS_DIR || "/app/uploads";
const ASSETS  = path.resolve("src/assets");

const TRIPS = [
  { slug:"lisbon-sun",       title:"Lisbon Sun",       kicker:"Lissabon",           region:"Europe",        where:"Portugal · Alfama, Bairro Alto", when:"Mai 2024 · 8 Tage",   month:"MAI 2024",  who:"Solo",              file:"trip-lisbon.jpg",
    excerpt:"Acht Tage zwischen Azulejos, gelben Trams und dem warmen Wind, der den Tejo hochzieht.",
    body:["Lissabon riecht morgens nach Brot und nach Salz vom Fluss. Ich bin jeden Tag den Hügel von Graça hinaufgelaufen, einmal, um zu schauen, ob die Stadt da unten noch da ist.","Die Tram 28 ist ein Klischee, aber sie funktioniert wie eine Zeitmaschine. Setze dich nach vorn, schließe die Augen halb, und du fährst durch sechs Jahrzehnte gleichzeitig.","Tipp: Geh nicht in die Pastéis-Schlange im Zentrum. Geh stattdessen nach Belém, früh, mit einem Espresso."]},
  { slug:"geiranger",        title:"Geiranger",        kicker:"Norwegische Fjorde", region:"Europe",        where:"Norwegen · Geirangerfjord",       when:"Juni 2024 · 12 Tage", month:"JUNI 2024", who:"Solo",              file:"trip-fjords.jpg",
    excerpt:"Zwölf Tage Stille zwischen Granit und Nebel. Manchmal hört man eine Möwe, manchmal nur sich selbst.",
    body:["Es gibt einen Moment in Geiranger, in dem die Wolken den Fjord küssen. Wenn du dann nicht stehenbleibst, hast du es nicht verstanden.","Ich habe in einer alten Berghütte über Eidsdal gewohnt. Kein WLAN, kein Empfang, ein Holzofen.","Praktisch: Miete dir kein Auto am Flughafen Ålesund — nimm den Bus bis Geiranger und das Schiff ab dort."]},
  { slug:"val-dorcia",       title:"Val D'Orcia",      kicker:"Toskana",            region:"Europe",        where:"Italien · Val d'Orcia, Pienza",   when:"Juli 2024 · 10 Tage", month:"JULI 2024", who:"mit Elena",         file:"trip-tuscany.jpg",
    excerpt:"Sanfte Hügel, Zypressenalleen und ein Licht, das jeden Sonnenuntergang zu einem Gemälde macht.",
    body:["Die Toskana ist genau so kitschig, wie alle sagen — und genau so schön.","In Pienza haben wir den besten Pecorino unseres Lebens gegessen.","Geheimtipp: Steh um 5 auf, fahr nach San Quirico, parke neben der Cappella della Madonna di Vitaleta."]},
  { slug:"black-sands",      title:"Black Sands",      kicker:"Island",             region:"Europe",        where:"Island · Vík, Reynisfjara",       when:"August 2024 · 14 Tage", month:"AUGUST 2024", who:"Solo",          file:"trip-iceland.jpg",
    excerpt:"Schwarzer Sand, basaltschwarze Klippen, weißes Meer. Island spielt nur mit drei Farben — aber laut.",
    body:["Reynisfjara ist ein Strand, an dem du nicht baden willst.","Ich habe vierzehn Tage lang die Ringstraße im Uhrzeigersinn abgefahren.","Was du brauchst: regenfeste Hose, echte Wanderschuhe, eine warme Mütze — auch im August."]},
  { slug:"concrete-jungle",  title:"Concrete Jungle",  kicker:"New York",           region:"North America", where:"USA · Brooklyn, Manhattan",       when:"September 2024 · 7 Tage", month:"SEPT 2024", who:"mit Marc",     file:"trip-nyc.jpg",
    excerpt:"Sieben Tage zwischen Dampf, Yellow Cabs und der Frage, wie viele Pizzen ein Mensch verträgt.",
    body:["New York ist laut. New York ist müde. New York ist absurd schön um sieben Uhr morgens.","Wir haben uns drei Tage lang nur durch Brooklyn gegessen.","Tipp: Nimm die Staten Island Ferry nach Sonnenuntergang."]},
  { slug:"rocky-mirror",     title:"Rocky Mirror",     kicker:"Banff",              region:"North America", where:"Kanada · Banff, Lake Moraine",    when:"Oktober 2024 · 9 Tage", month:"OKT 2024",  who:"mit Elena & Marc", file:"trip-banff.jpg",
    excerpt:"Türkises Wasser unter grauen Wolken — die kanadischen Rockies haben uns dreimal stehenbleiben lassen.",
    body:["Lake Moraine im Oktober: keine Touristenbusse mehr, dafür Schnee an den Hängen.","Wir haben in einer kleinen Lodge in Canmore gewohnt.","Wichtig: Bär-Spray dabeihaben. Wirklich."]},
  { slug:"route-66",         title:"Mother Road",      kicker:"Route 66",           region:"North America", where:"USA · Arizona → Kalifornien",     when:"November 2024 · 16 Tage", month:"NOV 2024", who:"mit Marc",     file:"trip-route66.jpg",
    excerpt:"Sechzehn Tage Asphalt, Neon und Motels, in denen die Klimaanlage lauter ist als die Gespräche.",
    body:["Route 66 ist nicht mehr die echte Route 66.","Wir haben in Seligman gehalten, in Oatman, in Amboy.","Praktisch: kein Cabrio. Klingt romantisch, ist es nicht."]},
  { slug:"yellowstone-steam",title:"Steam & Bison",    kicker:"Yellowstone",        region:"North America", where:"USA · Wyoming, Yellowstone NP",   when:"Dezember 2024 · 6 Tage",  month:"DEZ 2024", who:"Solo",          file:"trip-yellowstone.jpg",
    excerpt:"Geysire im Schnee, Bisons im Nebel, –22 °C beim Frühstück.",
    body:["Im Winter ist Yellowstone ein anderer Planet.","Old Faithful im Schneetreiben ist eine Sache, die du gesehen haben musst.","Tipp: Buche die Snow Lodge ein halbes Jahr vorher."]},
];

async function ensureDirs() {
  for (const d of ["originals","webp","avif"]) {
    await fs.mkdir(path.join(UPLOADS, d), { recursive: true });
  }
}

async function processImage(srcPath) {
  const id = crypto.randomUUID();
  const ext = path.extname(srcPath).toLowerCase() || ".jpg";
  const origRel = `/uploads/originals/${id}${ext}`;
  await fs.copyFile(srcPath, path.join(UPLOADS, "originals", `${id}${ext}`));

  const input = sharp(srcPath).rotate();
  const meta = await input.metadata();
  const sizes = [400, 1200, 2000];
  const paths = {};
  for (const w of sizes) {
    const webp = `/uploads/webp/${id}_${w}.webp`;
    const avif = `/uploads/avif/${id}_${w}.avif`;
    await input.clone().resize({ width: w, withoutEnlargement: true }).webp({ quality: 82 })
      .toFile(path.join(UPLOADS, "webp", `${id}_${w}.webp`));
    await input.clone().resize({ width: w, withoutEnlargement: true }).avif({ quality: 55 })
      .toFile(path.join(UPLOADS, "avif", `${id}_${w}.avif`));
    paths[`webp_${w}`] = webp;
    paths[`avif_${w}`] = avif;
  }
  return { id, original_path: origRel, width: meta.width, height: meta.height, mime: `image/${(meta.format||"jpeg")}`, ...paths };
}

const sql = postgres(process.env.DATABASE_URL, { max: 1 });

const [{ count }] = await sql`SELECT count(*)::int as count FROM trips`;
if (count > 0) {
  console.log(`seed: trips table has ${count} rows, skipping.`);
  await sql.end();
  process.exit(0);
}

await ensureDirs();
console.log("seed: processing demo trips…");

for (const t of TRIPS) {
  const src = path.join(ASSETS, t.file);
  try { await fs.access(src); } catch { console.warn(`seed: asset missing ${src}, skip`); continue; }
  const img = await processImage(src);

  const [tripRow] = await sql`
    INSERT INTO trips (slug, title, kicker, region, where_text, when_text, month_label, who_text, excerpt, body_md, published)
    VALUES (${t.slug}, ${t.title}, ${t.kicker}, ${t.region}, ${t.where}, ${t.when}, ${t.month}, ${t.who}, ${t.excerpt}, ${t.body.join("\n\n")}, true)
    RETURNING id
  `;

  const [imgRow] = await sql`
    INSERT INTO images (trip_id, original_path, webp_400, webp_1200, webp_2000, avif_400, avif_1200, avif_2000, width, height, mime, alt, sort_order)
    VALUES (${tripRow.id}, ${img.original_path}, ${img.webp_400}, ${img.webp_1200}, ${img.webp_2000}, ${img.avif_400}, ${img.avif_1200}, ${img.avif_2000}, ${img.width}, ${img.height}, ${img.mime}, ${t.title}, 0)
    RETURNING id
  `;

  await sql`UPDATE trips SET cover_image_id = ${imgRow.id} WHERE id = ${tripRow.id}`;
  console.log(`  ✓ ${t.slug}`);
}

console.log("seed: done.");
await sql.end();

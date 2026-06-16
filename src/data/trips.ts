import lisbon from "@/assets/trip-lisbon.jpg";
import fjords from "@/assets/trip-fjords.jpg";
import tuscany from "@/assets/trip-tuscany.jpg";
import iceland from "@/assets/trip-iceland.jpg";
import nyc from "@/assets/trip-nyc.jpg";
import banff from "@/assets/trip-banff.jpg";
import route66 from "@/assets/trip-route66.jpg";
import yellowstone from "@/assets/trip-yellowstone.jpg";

export type Trip = {
  slug: string;
  title: string;
  kicker: string;
  region: "Europe" | "North America";
  where: string;
  when: string;
  monthLabel: string;
  who: string;
  cover: string;
  excerpt: string;
  body: string[];
};

export const trips: Trip[] = [
  {
    slug: "lisbon-sun",
    title: "Lisbon Sun",
    kicker: "Lissabon",
    region: "Europe",
    where: "Portugal · Alfama, Bairro Alto",
    when: "Mai 2024 · 8 Tage",
    monthLabel: "MAI 2024",
    who: "Solo",
    cover: lisbon,
    excerpt: "Acht Tage zwischen Azulejos, gelben Trams und dem warmen Wind, der den Tejo hochzieht.",
    body: [
      "Lissabon riecht morgens nach Brot und nach Salz vom Fluss. Ich bin jeden Tag den Hügel von Graça hinaufgelaufen, einmal, um zu schauen, ob die Stadt da unten noch da ist.",
      "Die Tram 28 ist ein Klischee, aber sie funktioniert wie eine Zeitmaschine. Setze dich nach vorn, schließe die Augen halb, und du fährst durch sechs Jahrzehnte gleichzeitig.",
      "Tipp: Geh nicht in die Pastéis-Schlange im Zentrum. Geh stattdessen nach Belém, früh, mit einem Espresso. Du wirst dich an die Wärme erinnern, nicht an die Süße.",
    ],
  },
  {
    slug: "geiranger",
    title: "Geiranger",
    kicker: "Norwegische Fjorde",
    region: "Europe",
    where: "Norwegen · Geirangerfjord",
    when: "Juni 2024 · 12 Tage",
    monthLabel: "JUNI 2024",
    who: "Solo",
    cover: fjords,
    excerpt: "Zwölf Tage Stille zwischen Granit und Nebel. Manchmal hört man eine Möwe, manchmal nur sich selbst.",
    body: [
      "Es gibt einen Moment in Geiranger, in dem die Wolken den Fjord küssen. Wenn du dann nicht stehenbleibst, hast du es nicht verstanden.",
      "Ich habe in einer alten Berghütte über Eidsdal gewohnt. Kein WLAN, kein Empfang, ein Holzofen. Drei Tage gebraucht, um den Lärm im Kopf abzuschalten.",
      "Praktisch: Miete dir kein Auto am Flughafen Ålesund — nimm den Bus bis Geiranger und das Schiff ab dort. Du kommst entspannter an und siehst mehr.",
    ],
  },
  {
    slug: "val-dorcia",
    title: "Val D'Orcia",
    kicker: "Toskana",
    region: "Europe",
    where: "Italien · Val d'Orcia, Pienza",
    when: "Juli 2024 · 10 Tage",
    monthLabel: "JULI 2024",
    who: "mit Elena",
    cover: tuscany,
    excerpt: "Sanfte Hügel, Zypressenalleen und ein Licht, das jeden Sonnenuntergang zu einem Gemälde macht.",
    body: [
      "Die Toskana ist genau so kitschig, wie alle sagen — und genau so schön. Wir sind jeden Abend mit einer Flasche Sangiovese auf einen anderen Hügel gefahren.",
      "In Pienza haben wir den besten Pecorino unseres Lebens gegessen. Wir wissen den Namen des Hofes nicht mehr. Vielleicht ist das in Ordnung.",
      "Geheimtipp: Steh um 5 auf, fahr nach San Quirico, parke neben der Cappella della Madonna di Vitaleta. Der Nebel liegt dann noch auf den Feldern.",
    ],
  },
  {
    slug: "black-sands",
    title: "Black Sands",
    kicker: "Island",
    region: "Europe",
    where: "Island · Vík, Reynisfjara",
    when: "August 2024 · 14 Tage",
    monthLabel: "AUGUST 2024",
    who: "Solo",
    cover: iceland,
    excerpt: "Schwarzer Sand, basaltschwarze Klippen, weißes Meer. Island spielt nur mit drei Farben — aber laut.",
    body: [
      "Reynisfjara ist ein Strand, an dem du nicht baden willst. Das Meer kommt schnell, leise, und es nimmt jedes Jahr Menschen mit. Bleib weit oben.",
      "Ich habe vierzehn Tage lang die Ringstraße im Uhrzeigersinn abgefahren. Der Osten ist leer, der Westen voll, der Norden überraschend grün.",
      "Was du brauchst: regenfeste Hose, echte Wanderschuhe, eine warme Mütze — auch im August. Was du nicht brauchst: Pläne nach 18 Uhr.",
    ],
  },
  {
    slug: "concrete-jungle",
    title: "Concrete Jungle",
    kicker: "New York",
    region: "North America",
    where: "USA · Brooklyn, Manhattan",
    when: "September 2024 · 7 Tage",
    monthLabel: "SEPT 2024",
    who: "mit Marc",
    cover: nyc,
    excerpt: "Sieben Tage zwischen Dampf, Yellow Cabs und der Frage, wie viele Pizzen ein Mensch verträgt.",
    body: [
      "New York ist laut. New York ist müde. New York ist absurd schön um sieben Uhr morgens, wenn die Sonne unter der Manhattan Bridge durchschlägt.",
      "Wir haben uns drei Tage lang nur durch Brooklyn gegessen. DUMBO, Williamsburg, Bushwick. Jede Pizza eine andere These über Käse.",
      "Tipp: Nimm die Staten Island Ferry nach Sonnenuntergang. Kostenlos, halbe Stunde, eine der besten Aussichten der Welt.",
    ],
  },
  {
    slug: "rocky-mirror",
    title: "Rocky Mirror",
    kicker: "Banff",
    region: "North America",
    where: "Kanada · Banff, Lake Moraine",
    when: "Oktober 2024 · 9 Tage",
    monthLabel: "OKT 2024",
    who: "mit Elena & Marc",
    cover: banff,
    excerpt: "Türkises Wasser unter grauen Wolken — die kanadischen Rockies haben uns dreimal stehenbleiben lassen.",
    body: [
      "Lake Moraine im Oktober: keine Touristenbusse mehr, dafür Schnee an den Hängen. Die Luft so klar, dass es ein bisschen wehtut zu atmen.",
      "Wir haben in einer kleinen Lodge in Canmore gewohnt. Jeden Morgen Pancakes, jeden Abend Elche auf der Straße.",
      "Wichtig: Bär-Spray dabeihaben. Wirklich. Wir haben einen Schwarzbären gesehen. Aus dem Auto. Trotzdem.",
    ],
  },
  {
    slug: "route-66",
    title: "Mother Road",
    kicker: "Route 66",
    region: "North America",
    where: "USA · Arizona → Kalifornien",
    when: "November 2024 · 16 Tage",
    monthLabel: "NOV 2024",
    who: "mit Marc",
    cover: route66,
    excerpt: "Sechzehn Tage Asphalt, Neon und Motels, in denen die Klimaanlage lauter ist als die Gespräche.",
    body: [
      "Route 66 ist nicht mehr die echte Route 66. Sie ist überall unterbrochen, umgeleitet, vergessen. Genau das macht sie gut.",
      "Wir haben in Seligman gehalten, in Oatman, in Amboy. Drei Tankstellen, drei Welten. Der Wirt in Amboy hat gesagt: \"Stay weird.\" Werden wir.",
      "Praktisch: kein Cabrio. Klingt romantisch, ist es nicht. Air-Condition, große Wasserflasche, Playlist offline.",
    ],
  },
  {
    slug: "yellowstone-steam",
    title: "Steam & Bison",
    kicker: "Yellowstone",
    region: "North America",
    where: "USA · Wyoming, Yellowstone NP",
    when: "Dezember 2024 · 6 Tage",
    monthLabel: "DEZ 2024",
    who: "Solo",
    cover: yellowstone,
    excerpt: "Geysire im Schnee, Bisons im Nebel, –22 °C beim Frühstück. Der wildeste Winter, den ich je hatte.",
    body: [
      "Im Winter ist Yellowstone ein anderer Planet. Die meisten Straßen sind gesperrt, du fährst mit einer Snowcoach rein, und plötzlich gehört dir der Park.",
      "Old Faithful im Schneetreiben ist eine Sache, die du gesehen haben musst, bevor du stirbst. Heißes Wasser, kaltes Licht, völlige Stille drumherum.",
      "Tipp: Buche die Snow Lodge ein halbes Jahr vorher. Es gibt im Park keine andere Übernachtung im Winter, die direkt am Old Faithful liegt.",
    ],
  },
];

export function getTrip(slug: string) {
  return trips.find((t) => t.slug === slug);
}

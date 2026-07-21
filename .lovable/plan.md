
# v0.6.3 — Galerie-Lightbox mit Navigation

## Ziel
Im Reisebericht (`/stories/$slug`) öffnet ein Klick auf ein Galeriebild eine In-App-Lightbox statt der rohen Bilddatei. Großes Bild oben, Thumbnails unten, Pfeile links/rechts, Tastatursteuerung, sauberer Fokus- und Scroll-Lifecycle.

## Verhaltensentscheidungen
- **Navigation zyklisch** (`(i+1) % n`, `(i-1+n) % n`).
- **Bei genau einem Bild**: Prev/Next-Buttons ausgeblendet, Thumbnail-Leiste versteckt.
- **Leere Galerie**: Lightbox rendert nicht.
- **Overlay-Klick schließt** nur bei `event.target === event.currentTarget`; Klicks auf Bild/Buttons/Thumbnails schließen nicht.
- **Alt-Text**: jedes Bild nutzt sein eigenes `img.alt`; Dialog-Label = `Bildergalerie: <trip.title>`.
- **Nicht enthalten** (spätere Versionen): Swipe, Pinch-to-Zoom, Deep-Link-URL (`?photo=…`).

## Neue Komponente `src/components/trip/GalleryLightbox.tsx`

Props:
```ts
type Props = {
  images: GalleryImage[];   // aus trips.functions
  startIndex: number;
  open: boolean;
  onClose: () => void;
  title: string;            // trip.title für Dialog-Label
};
```

Aufbau:
- Full-Screen Overlay `fixed inset-0`, dunkler Hintergrund.
- Projektspezifische Klasse in `src/styles.css`:
  ```css
  .gallery-lightbox { z-index: 1000; overscroll-behavior: contain; }
  ```
- `role="dialog"` + `aria-modal="true"` + `aria-label={"Bildergalerie: " + title}`.
- Kopfzeile: Zähler `n / total` links, Close-Button rechts (`aria-label="Schließen"`).
- Mitte: `ResponsivePicture` mit `sizes="(max-width: 768px) 100vw, 1600px"`, flankiert von Prev/Next-Buttons (`lucide-react` Chevrons, `aria-label="Vorheriges Bild" / "Nächstes Bild"`).
- Unten: horizontal scrollbare Thumbnail-Leiste; aktives Thumbnail mit `border-primary` und `aria-current="true"`.
- Bild-Alt = `img.alt ?? title`.

### State & Lifecycle (Feinheiten aus Review)

**Interner `activeIndex`, nur beim Öffnen aus `startIndex` initialisieren:**
```ts
const [activeIndex, setActiveIndex] = useState(startIndex);
useEffect(() => {
  if (open) {
    setActiveIndex(Math.min(Math.max(startIndex, 0), images.length - 1));
  }
}, [open, startIndex, images.length]);
```

**Fokus + Scroll-Lock in einem Effekt, Abhängigkeit nur `open`** (nicht `activeIndex` — sonst würde die Fokus-Rückgabe bei jedem Bildwechsel feuern):
```ts
useEffect(() => {
  if (!open) return;
  const previouslyFocused = document.activeElement as HTMLElement | null;
  const prevOverflow = document.body.style.overflow;
  const prevPaddingRight = document.body.style.paddingRight;
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
  document.body.style.overflow = "hidden";
  if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
  closeButtonRef.current?.focus();
  return () => {
    document.body.style.overflow = prevOverflow;
    document.body.style.paddingRight = prevPaddingRight;
    previouslyFocused?.focus();
  };
}, [open]);
```

**Focus-Trap**: separater `keydown`-Handler (nur wenn `open`), fängt `Tab`/`Shift+Tab` und rotiert innerhalb der fokussierbaren Elemente im Root-Ref.

**Keyboard**: nur wenn `open === true`. `Escape` schließt, `ArrowLeft`/`ArrowRight` blättern zyklisch. Ignoriert, wenn `event.target.tagName` in `INPUT`/`TEXTAREA`/`SELECT`.

**Reduced Motion**: `matchMedia("(prefers-reduced-motion: reduce)")` → `behavior:"auto"` sonst `"smooth"` beim Thumbnail-Scroll.

**Aktives Thumbnail sichtbar halten**: bei Index-Wechsel
```ts
activeThumbRef.current?.scrollIntoView({ behavior, block: "nearest", inline: "center" });
```

**Preload benachbarter Bilder**: nur „best effort", wenn eine stabile URL vorhanden ist. Helper `getLargestSrc(img)` mit Fallback-Kette `webp[2000] ?? webp[1200] ?? webp[400]`; wenn keine dieser Varianten ein String ist, wird nichts vorgeladen.

## `src/routes/stories.$slug.tsx`
- Galerie-`<a href>` durch `<button type="button" onClick={() => setLightboxIndex(i)}>` ersetzen; `ResponsivePicture` bleibt Kind des Buttons.
- `const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)`.
- Unter der Galerie: `{lightboxIndex !== null && <GalleryLightbox open images={trip.gallery} startIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} title={trip.title} />}`.
- Videos bleiben unverändert. Keine Backend-/DB-/API-Änderungen.

## Version
`package.json` → **v0.6.3**.

## Tests / manuelle Checkliste
- Klick auf Bild öffnet Lightbox mit richtigem Index; wiederholtes Öffnen startet stets bei geklicktem Bild.
- `Escape` schließt; `ArrowLeft`/`ArrowRight` blättern zyklisch.
- Thumbnail-Klick wechselt Bild und aktualisiert `aria-current` + Autoscroll.
- Hintergrundklick schließt; Klicks auf Bild/Button/Thumbnail schließen nicht.
- Body-`overflow`/`padding-right` nach Schließen exakt wiederhergestellt.
- Fokus nach Schließen liegt auf dem auslösenden Galerie-Button.
- Bei einem Bild werden Pfeile und Thumbnail-Leiste nicht gerendert.
- Leere Galerie rendert keine Lightbox.

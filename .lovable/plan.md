## Ziel (Variante B)
Der Menüpunkt „Studio" wird aus der öffentlichen Navigation entfernt und erscheint nur für angemeldete Benutzer. Zugang für Admins läuft über das Lesezeichen `/admin` → Login → `/admin/studio`.

## Umsetzung

**1. `src/components/SiteHeader.tsx`**
- `Studio`-Eintrag aus der `nav`-Konstante entfernen.
- Neuen Client-Hook `useIsAuthenticated()` einbinden (siehe Punkt 2). Wenn `true`, wird ein zusätzlicher Link „Studio" (→ `/admin/studio`) und „Abmelden" (POST `/api/auth/logout` → Redirect `/`) rechts in der Navigation gerendert — sowohl in der Desktop- als auch in der Mobile-Ansicht.
- Kein Layout-Shift beim ersten Render: Solange der Status unbekannt ist (`null`), werden die Admin-Links nicht angezeigt.

**2. `src/hooks/useIsAuthenticated.ts` (neu)**
- Kleiner Hook, der einmalig `GET /api/auth/me` mit `credentials: "same-origin"` aufruft und den Boolean-Status zurückgibt (`null | boolean`).
- Nutzt internes Modul-Cache, damit mehrere Header-Instanzen / Navigationswechsel nicht mehrfach abfragen. Nach `logout` wird der Cache invalidiert.
- Reagiert auf ein `window`-Event `nahundfern:auth-changed`, das von Login/Logout gefeuert wird.

**3. `src/routes/admin.login.tsx`**
- Nach erfolgreichem Login zusätzlich `window.dispatchEvent(new Event("nahundfern:auth-changed"))`, damit der Header sofort umschaltet (bestehender Redirect bleibt).

**4. `src/routes/admin.tsx`**
- Redirect `/admin` → `/admin/studio` bleibt bestehen. Zusätzlich: Wenn keine Session → Redirect auf `/admin/login` (aktuell fällt das nur intern in Studio auf). Umsetzung im `beforeLoad` über einen Fetch auf `/api/auth/me`; bei 401 → `throw redirect({ to: "/admin/login" })`.

**5. Logout-Verhalten**
- Im Header-Logout-Button: nach erfolgreichem POST → `dispatchEvent("nahundfern:auth-changed")` + `navigate({ to: "/" })`.
- Der bestehende Logout-Button in `admin.studio.index.tsx` bleibt zusätzlich erhalten.

**6. Version — `package.json`**
- Bump auf **v0.5.7**.

## Nicht Teil dieses Plans
- Der Sicherheitsaspekt (requireAuth auf allen Studio-APIs) ist unverändert; das Verstecken des Links ist reine UX.
- Server-Session im Root-Loader (SSR) wird bewusst **nicht** verdrahtet, um die Auth-Middleware-Fallstricke von TanStack Start (Prerender/build:dev) zu umgehen. Der Header rendert die Admin-Links client-seitig nach dem `/api/auth/me`-Check.

## Technische Notizen
- `/api/auth/me` existiert bereits und ist der offizielle Session-Check.
- Kein neuer Endpoint nötig.
- Kein neues Design; nur bestehende Header-Styles wiederverwendet.

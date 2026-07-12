## Ziel

1. Den Nginx-Crashloop-Fix ins GitHub-Repo bringen (aktuell hängt der Container an fehlenden Let's-Encrypt-Zertifikaten).
2. Einen einfachen Startmechanismus mit vier Modi einführen:
   - `test1` — Test-Modus **ohne** TLS (HTTP-only, beliebige IP/Hostname) ← aktueller Anwendungsfall
   - `test2` — Test-Modus **mit** TLS (self-signed, für lokale HTTPS-Tests)
   - `test3` — Live-Modus **ohne** TLS (produktive Domain, aber nur HTTP — z. B. hinter Reverse-Proxy)
   - `test4` — Live-Modus **mit** TLS (Let's Encrypt, produktive Domain) ← Endzustand

## Bitte kurz bestätigen

- **Rückfrage 1:** Ist mein Verständnis von „test" (= beliebige IP/Hostname, keine echte Domain) vs. „live" (= Domain `nahundfern.servuswir.de`) korrekt?
- **Rückfrage 2:** Soll `test2` ein **self-signed**-Zertifikat automatisch erzeugen, oder erwartest du dort dieselbe Let's-Encrypt-Logik wie in `test4` (dann bräuchte auch der Testmodus eine echte Domain und DNS)?

Ich gehe im Plan von „test2 = self-signed" aus — sag Bescheid, falls anders.

## Änderungen im Repo

### 1. Nginx-Konfigurationen sauber trennen

- **Neu:** `nginx/conf.d.http/site.conf` — HTTP-only, kein `server_name` (Inhalt = aktuelles `site.dev.conf`).
- **Neu:** `nginx/conf.d.selfsigned/site.conf` — HTTP + HTTPS mit Zertifikatpfad `/etc/nginx/certs/…`.
- **Behalten:** `nginx/conf.d/site.conf` — produktiv mit Let's Encrypt (unverändert).
- **Löschen:** `nginx/conf.d/site.dev.conf` (wandert nach `conf.d.http/`).

Grund für getrennte Verzeichnisse: der Base-Compose mountet `./nginx/conf.d` komplett; ein Datei-Override im gleichen Zielverzeichnis wird von Docker nicht wie erhofft angewendet — deshalb crash-loopt Nginx aktuell. Sauber ist ein **Verzeichnis-Swap** per Override.

### 2. Vier Compose-Overrides

- `docker-compose.test1.yml` — mountet `./nginx/conf.d.http`, entfernt `letsencrypt`/`certbot-www`-Mounts, deaktiviert den `certbot`-Service.
- `docker-compose.test2.yml` — mountet `./nginx/conf.d.selfsigned` + `./nginx/certs:/etc/nginx/certs:ro`, deaktiviert `certbot`.
- `docker-compose.test3.yml` — mountet `./nginx/conf.d.http`, setzt `PUBLIC_BASE_URL` auf die Live-Domain, deaktiviert `certbot`.
- `docker-compose.test4.yml` — leer/no-op (nutzt Base-Compose = Let's-Encrypt-Setup wie in DEPLOYMENT.md).

Die alte `docker-compose.override.yml` wird entfernt (weil sie automatisch geladen wird und die Modi überschreiben würde).

### 3. Start-Skript `./scripts/run.sh <mode>`

```bash
./scripts/run.sh test1   # Test, HTTP-only  (aktueller Anwendungsfall)
./scripts/run.sh test2   # Test, self-signed HTTPS
./scripts/run.sh test3   # Live-Domain, HTTP-only
./scripts/run.sh test4   # Live, Let's Encrypt (produktiv)
```

Das Skript:
- validiert das Argument,
- generiert bei `test2` einmalig ein self-signed Cert unter `./nginx/certs/` (falls fehlt),
- ruft `docker compose -f docker-compose.yml -f docker-compose.<mode>.yml up -d --build` auf,
- gibt am Ende `docker compose ps` aus.

Ein `./scripts/stop.sh` (`docker compose down`) rundet es ab.

### 4. Doku aktualisieren

- **`TEST.md`** — auf neuen Workflow umstellen: „`./scripts/run.sh test1` statt manuelles `docker compose up`".
- **`DEPLOYMENT.md`** — Produktivpfad erklärt jetzt `test4` (Bootstrap-Trick für Zertifikate bleibt drin).
- **`README.md`** (falls vorhanden) — kurze Tabelle der vier Modi.

## GitHub-Sync

Lovable synct beim nächsten Build automatisch mit dem verbundenen GitHub-Repo (`Softhuby99/Reiseblog`). Ein zusätzlicher Push von meiner Seite ist nicht nötig — sobald du den Plan bestätigst und ich in den Build-Mode wechsle, landen die Dateien im Repo, und du kannst auf dem Server einfach `git pull` machen.

## Ergebnis auf dem Server

```bash
cd /opt/nahundfern
git pull
./scripts/run.sh test1
curl -I http://localhost   # 200/302 von der App
```

Der aktuelle Crashloop ist damit weg, weil im HTTP-Modus keine TLS-Config mehr geladen wird.

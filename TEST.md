# Start-Modi

Der Stack unterstützt vier Startmodi über `./scripts/run.sh <modus>`:

| Modus   | Umgebung | TLS                  | Anwendungsfall                                     |
|---------|----------|----------------------|----------------------------------------------------|
| `test1` | Test     | ohne                 | Erster Funktionstest, beliebige IP/Hostname, Port 80 |
| `test2` | Test     | self-signed HTTPS    | Lokale HTTPS-Tests (Zertifikat wird automatisch erzeugt) |
| `test3` | Live     | ohne                 | Produktive Domain hinter externem TLS-Proxy         |
| `test4` | Live     | Let's Encrypt HTTPS  | Produktivbetrieb — siehe `DEPLOYMENT.md`           |

Starten / Stoppen:

```bash
./scripts/run.sh test1        # HTTP-only Testbetrieb
./scripts/stop.sh
```

Die Modi laden je ein `docker-compose.<modus>.yml` zusätzlich zum Base-Compose;
`nginx/conf.d/site.conf` (produktiv) bleibt in allen Test-Modi ungenutzt und
unangetastet.

---

# Lokaler HTTP-Test (Modus `test1`)

Diese Anleitung startet den vollen Stack lokal auf Port 80, ohne TLS und ohne
Let's Encrypt. Ideal für den ersten Funktionstest auf dem Debian-Server.

## Voraussetzungen

- Debian 12 (oder vergleichbare Linux-Distribution)
- Docker + Docker Compose installiert
- User `deploy` mit `docker`-Gruppe
- Port 80 frei (kein anderer Webserver)
- ca. 2 GB freier Speicherplatz
- Keine Domain, DNS oder TLS notwendig

## 1. Vorbereitung als root

```bash
usermod -aG docker deploy
mkdir -p /opt/nahundfern
chown -R deploy:deploy /opt/nahundfern
ufw allow 80
```

## 2. Projekt als deploy auschecken

```bash
su - deploy
cd /opt/nahundfern
git clone https://github.com/Softhuby99/Reiseblog.git .
cp .env.example .env
```

## 3. `.env` anpassen

```bash
PUBLIC_BASE_URL=http://<server-ip-oder-localhost>
DB_USER=nahundfern
DB_PASSWORD=$(openssl rand -hex 16)
DB_NAME=nahundfern
JWT_SECRET=$(openssl rand -hex 32)
SEED_ON_START=true
LETSENCRYPT_EMAIL=you@example.com
```

## 4. Stack starten (HTTP-only)

```bash
cd /opt/nahundfern
./scripts/run.sh test1
docker compose logs -f app     # bis "Listening on :3000" erscheint
```

## 5. Test der öffentlichen Seiten

- `http://<server-ip>/`
- `http://<server-ip>/stories`
- `http://<server-ip>/stories/<slug>`
- `http://<server-ip>/timeline`

## 6. Admin-User anlegen

```bash
docker compose exec app node scripts/create-user.js test@example.com
```

Passwort interaktiv eingeben (mindestens 10 Zeichen).

## 7. Admin-Bereich testen

- `http://<server-ip>/admin/login`

## 8. Stack stoppen

```bash
./scripts/stop.sh
```

Daten bleiben in den Docker-Volumes (`pgdata`, `uploads`) erhalten. Mit
`./scripts/stop.sh -v` werden auch die Daten gelöscht.

## 9. Weitere Test-Modi

- **`./scripts/run.sh test2`** — self-signed HTTPS. Beim ersten Start wird
  `nginx/certs/{fullchain,privkey}.pem` per `openssl` erzeugt. Browser warnen
  wegen des unbekannten Ausstellers — das ist gewollt.
- **`./scripts/run.sh test3`** — HTTP-only mit produktiver Domain im
  `PUBLIC_BASE_URL`, gedacht für den Betrieb hinter einem externen
  TLS-Terminator (Cloudflare, Traefik, o. ä.).

## 10. Danach: Produktivbetrieb (`test4`)

Wenn ein HTTP- oder Selfsigned-Test erfolgreich war:

1. `./scripts/stop.sh`
2. `.env` auf `PUBLIC_BASE_URL=https://nahundfern.servuswir.de` setzen.
3. `DEPLOYMENT.md` ab Schritt 3 folgen (TLS-Bootstrap mit Let's Encrypt).
4. Am Ende produktiv starten mit `./scripts/run.sh test4`.

## Troubleshooting

| Symptom                              | Prüfen / Lösung                                                          |
|--------------------------------------|--------------------------------------------------------------------------|
| Port 80 bereits belegt               | `ss -tlnp \| grep :80` — anderen Dienst stoppen (System-nginx? `systemctl stop nginx`) |
| `permission denied` bei Docker       | `groups` muss `docker` enthalten; neu einloggen oder `newgrp docker`     |
| nginx crash-loopt / kein Port 80     | Modus falsch — `./scripts/run.sh test1` statt `docker compose up` nutzen |
| `502 Bad Gateway`                    | `docker compose logs app` — meist DB-Verbindung oder Build-Fehler        |
| Bilder werden nicht angezeigt        | `docker compose logs nginx`; `docker volume inspect nahundfern_uploads`  |
| Login zeigt „Unauthorized"           | Admin-User mit `scripts/create-user.js` neu anlegen                      |

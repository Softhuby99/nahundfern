# Lokaler HTTP-Test (ohne Domain, ohne TLS)

Diese Anleitung startet den vollen Stack lokal auf Port 80, ohne TLS und ohne Let's Encrypt. Ideal für den ersten Funktionstest auf dem Debian-Server.

## Voraussetzungen

- Debian 12 (oder vergleichbare Linux-Distribution)
- Docker + Docker Compose installiert
- User `deploy` mit `docker`-Gruppe
- Port 80 frei (kein anderer Webserver)
- ca. 2 GB freier Speicherplatz
- Keine Domain, DNS oder TLS notwendig

## 1. Vorbereitung als root

```bash
# deploy gehört zu docker
usermod -aG docker deploy

# Installationsverzeichnis anlegen
mkdir -p /opt/nahundfern
chown -R deploy:deploy /opt/nahundfern

# Port 80 in der Firewall freigeben
ufw allow 80
```

## 2. Projekt als deploy auschecken

```bash
su - deploy
cd /opt/nahundfern
git clone https://github.com/Softhuby99/Reiseblog.git .
cp .env.example .env
```

## 3. `.env` für HTTP-Test anpassen

```bash
# In /opt/nahundfern/.env editieren
PUBLIC_BASE_URL=http://<server-ip-oder-localhost>
DB_USER=nahundfern
DB_PASSWORD=$(openssl rand -hex 16)
DB_NAME=nahundfern
JWT_SECRET=$(openssl rand -hex 32)
SEED_ON_START=true
LETSENCRYPT_EMAIL=you@example.com
```

Für einen reinen lokalen Test am Server selbst: `PUBLIC_BASE_URL=http://localhost`. Von einem anderen Rechner im Netz: `http://<server-ip>`.

## 4. Stack mit HTTP-Override starten

Der HTTP-Modus verwendet `docker-compose.override.yml` und `nginx/conf.d/site.dev.conf`. TLS und Certbot bleiben dabei deaktiviert, die originalen Config-Dateien bleiben unangetastet.

```bash
cd /opt/nahundfern
docker compose up -d --build
```

Logs beobachten, bis die App bereit ist:

```bash
docker compose logs -f app
```

Warte auf die Zeile `listening on :3000`. Das initiale Seeding läuft beim ersten Start automatisch (`SEED_ON_START=true`) und importiert die Demo-Reisen inklusive Bilder.

## 5. Test der öffentlichen Seiten

Öffne im Browser:

- `http://<server-ip>/`
- `http://<server-ip>/stories`
- `http://<server-ip>/stories/<slug>`
- `http://<server-ip>/timeline`

## 6. Admin-User anlegen

```bash
cd /opt/nahundfern
docker compose exec app node scripts/create-user.js test@example.com
```

Interaktiv ein Passwort eingeben (mindestens 10 Zeichen).

## 7. Admin-Bereich testen

Browser öffnen:

- `http://<server-ip>/admin/login`

Mit Admin-E-Mail und Passwort einloggen. Du landest automatisch im Reise-Editor (`/admin/studio`). Dort kannst du neue Reisen anlegen, bestehende bearbeiten und Bilder hochladen.

## 8. Stack stoppen

```bash
cd /opt/nahundfern
docker compose down
```

Daten bleiben in den Docker-Volumes (`pgdata`, `uploads`) erhalten. Mit `docker compose down -v` werden auch die Daten gelöscht.

## 9. Danach: Produktiv mit TLS

Wenn der HTTP-Test erfolgreich war:

1. `docker compose down` ausführen.
2. `docker-compose.override.yml` entfernen oder umbenennen (z.B. `docker-compose.override.yml.off`).
3. `.env` auf `PUBLIC_BASE_URL=https://nahundfern.servuswir.de` setzen.
4. DEPLOYMENT.md ab Schritt 3 folgen (TLS-Bootstrap mit Let's Encrypt).

## Troubleshooting

| Symptom                              | Prüfen / Lösung                                                          |
|--------------------------------------|--------------------------------------------------------------------------|
| Port 80 bereits belegt               | `ss -tlnp | grep :80` — anderen Dienst stoppen oder in Compose Port ändern |
| `permission denied` bei Docker       | `groups` muss `docker` enthalten; neu einloggen oder `newgrp docker`       |
| `502 Bad Gateway`                    | `docker compose logs app` — meist DB-Verbindung oder Build-Fehler          |
| Bilder werden nicht angezeigt        | `docker compose logs nginx` und Volume-Prüfung mit `docker volume inspect nahundfern_uploads` |
| Login zeigt „Unauthorized"           | Admin-User mit `scripts/create-user.js` neu anlegen                        |

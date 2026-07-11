# Deployment — nahundfern.servuswir.de

Kompletter Self-Host-Stack: Docker Compose auf Debian 12, TLS via Let's Encrypt, alles in Containern. Für die allererste Testphase ohne Domain und TLS siehe `TEST.md`.

## 1. Server vorbereiten (Debian 12)

Als `root` ausführen:

```bash
# Docker + Compose
apt update && apt install -y ca-certificates curl gnupg git
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian bookworm stable" \
  | tee /etc/apt/sources.list.d/docker.list
apt update && apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Deploy-User anlegen/vorbereiten
useradd -m -s /bin/bash deploy 2>/dev/null || true
usermod -aG docker deploy
usermod -aG sudo deploy 2>/dev/null || true

# Installationsverzeichnis
mkdir -p /opt/nahundfern
chown -R deploy:deploy /opt/nahundfern

# Firewall
apt install -y ufw
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw enable
```

DNS: A-Record `nahundfern.servuswir.de` → Server-IP.

## 2. Projekt holen und konfigurieren

Ab jetzt als User `deploy` arbeiten:

```bash
su - deploy
cd /opt/nahundfern
git clone https://github.com/Softhuby99/Reiseblog.git .
cp .env.example .env
# .env editieren: DB_PASSWORD, JWT_SECRET (openssl rand -hex 32), LETSENCRYPT_EMAIL
```

## 3. TLS-Bootstrap (einmalig)

Certbot braucht einen laufenden HTTP-Server auf Port 80, um die ACME-Challenge zu beantworten. Vorgehen:

```bash
# 3a. Temporäre nginx-Konfig OHNE die ssl_certificate-Zeilen benutzen:
#     Kommentiere in nginx/conf.d/site.conf die ssl_certificate*-Zeilen
#     und die 'listen 443' Blöcke einmalig aus.

docker compose up -d nginx

# 3b. Zertifikat holen
docker compose run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  -d nahundfern.servuswir.de \
  --email "$(grep LETSENCRYPT_EMAIL .env | cut -d= -f2)" \
  --agree-tos --no-eff-email

# 3c. Kommentierte Zeilen wieder aktivieren, nginx neu laden
docker compose restart nginx
```

Danach erneuert der `certbot`-Container automatisch alle 12h.

## 4. Vollen Stack starten

```bash
docker compose up -d --build
docker compose logs -f app     # bis "listening on :3000" erscheint
```

Beim ersten Start läuft `scripts/seed.js` (weil `SEED_ON_START=true`) und importiert die 8 Demo-Reisen inklusive Bilder in die Datenbank. Danach kannst du `SEED_ON_START=false` setzen.

## 5. Admin-User anlegen

```bash
docker compose exec app node scripts/create-user.js du@nahundfern.servuswir.de
# Passwort interaktiv eingeben (min. 10 Zeichen)
```

Login: `https://nahundfern.servuswir.de/admin/login` — dort landest du im Reise-Editor (`/admin/studio`).

## 6. Backups

Nächtliches DB-Backup (Cron auf dem Host):

```bash
tee /etc/cron.daily/nahundfern-backup >/dev/null <<'SH'
#!/bin/sh
set -e
DEST=/var/backups/nahundfern
mkdir -p "$DEST"
cd /opt/nahundfern
su - deploy -c "docker compose exec -T db pg_dump -U \"$(grep DB_USER .env | cut -d= -f2)\" \"$(grep DB_NAME .env | cut -d= -f2)\" | gzip" > "$DEST/db-$(date +%F).sql.gz"
find "$DEST" -name 'db-*.sql.gz' -mtime +14 -delete
SH
chmod +x /etc/cron.daily/nahundfern-backup
```

Uploads separat sichern (extern):

```bash
# Volume-Pfad ermitteln
docker volume inspect nahundfern_uploads
# rsync/restic auf externen Server
```

## 7. Update deployen

```bash
git pull
docker compose build app
docker compose up -d app
```

nginx und db laufen dabei durch — kein Downtime.

## 8. Troubleshooting

| Symptom                             | Prüfen                                                      |
|-------------------------------------|-------------------------------------------------------------|
| 502 Bad Gateway                     | `docker compose logs app` — meist DB-Verbindung             |
| Login: „Unauthorized"               | Passwort per `scripts/create-user.js` neu setzen            |
| Bilder werden nicht angezeigt       | `docker volume inspect nahundfern_uploads`, nginx-Alias     |
| Zertifikat läuft ab                 | `docker compose logs certbot`                               |

## Architektur

Siehe `architecture.mmd` (im Studio als Diagramm sichtbar).

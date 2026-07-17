# Let's Encrypt Zertifikat für `nahundfern.servuswir.de`

Diese Anleitung beschreibt, **wie** du das TLS-Zertifikat einmalig ausstellst,
**wo** es abgelegt wird und **wie** es automatisch erneuert wird.
Sie gilt für den Live-Modus (`./scripts/run.sh test4`) auf dem Server
`/opt/nahundfern`.

---

## 1. Voraussetzungen (einmalig prüfen)

Bevor Let's Encrypt ein Zertifikat ausstellen kann, muss folgendes stimmen:

| Punkt                              | Prüfung                                                                        | Wo einstellen                               |
| ---------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------- |
| **DNS A-Record**                   | `nahundfern.servuswir.de` zeigt auf die öffentliche IP des Servers `WebSrv-1`  | beim DNS-Anbieter der Domain `servuswir.de` |
| **Port 80 offen**                  | eingehend TCP/80 aus dem Internet erreichbar (Let's Encrypt HTTP-01 Challenge) | Firewall / Hoster                           |
| **Port 443 offen**                 | eingehend TCP/443 erreichbar                                                   | Firewall / Hoster                           |
| **Kein anderer Dienst auf 80/443** | `sudo ss -tlnp \| grep -E ':80\|:443'` zeigt nichts außer Docker               | Server                                      |
| **`.env` vorhanden**               | `/opt/nahundfern/.env` mit `PUBLIC_BASE_URL=https://nahundfern.servuswir.de`   | Server                                      |

DNS-Check vom Server:

```bash
dig +short nahundfern.servuswir.de
# muss die IP des Servers ausgeben
```

---

## 2. Zertifikat ausstellen (einmalig)

Das produktive nginx erwartet die Zertifikate schon beim Start – deshalb
holen wir sie **zuerst** mit einer HTTP-only-Konfiguration und starten
danach den Live-Stack.

### 2.1 HTTP-only Stack starten (nur nginx auf Port 80 für ACME)

```bash
cd /opt/nahundfern
git pull
./scripts/run.sh test3     # Live-Domain, HTTP-only – hört auf Port 80
```

Kurz prüfen, dass die ACME-URL erreichbar ist:

```bash
curl -I http://nahundfern.servuswir.de/.well-known/acme-challenge/test
# 404 ist OK – wichtig ist: keine Timeouts / kein Connection refused
```

### 2.2 Certbot einmalig ausführen

```bash
docker run --rm \
  -v nahundfern_letsencrypt:/etc/letsencrypt \
  -v nahundfern_certbot-www:/var/www/certbot \
  certbot/certbot certonly \
    --webroot -w /var/www/certbot \
    -d nahundfern.servuswir.de \
    --email admin@servuswir.de \
    --agree-tos --no-eff-email --non-interactive
```

> Hinweis: Der Präfix der Volume-Namen (`nahundfern_`) entspricht dem
> Compose-Projektnamen (Ordnername `/opt/nahundfern`). Prüfen mit
> `docker volume ls | grep letsencrypt`.

Bei Erfolg meldet Certbot:

```
Successfully received certificate.
Certificate is saved at: /etc/letsencrypt/live/nahundfern.servuswir.de/fullchain.pem
Key is saved at:         /etc/letsencrypt/live/nahundfern.servuswir.de/privkey.pem
```

### 2.3 Auf Live umschalten

```bash
./scripts/stop.sh
./scripts/run.sh test4     # Live + HTTPS mit Let's Encrypt
```

Prüfen:

```bash
curl -I https://nahundfern.servuswir.de
# HTTP/2 200 (oder 302)
```

---

## 3. Wo liegen die Zertifikate?

Die Dateien werden **nicht** im Repo abgelegt, sondern in einem
Docker Named Volume – dadurch überleben sie Container-Neustarts und
Image-Updates, und sie tauchen nicht in Git auf.

| Ort                                    | Bedeutung                                                     |
| -------------------------------------- | ------------------------------------------------------------- |
| Docker-Volume `nahundfern_letsencrypt` | persistenter Speicher (bleibt auf dem Host)                   |
| Mount im nginx-Container               | `/etc/letsencrypt` (read-only)                                |
| Mount im certbot-Container             | `/etc/letsencrypt` (read-write, für Renewals)                 |
| Zertifikat-Datei                       | `/etc/letsencrypt/live/nahundfern.servuswir.de/fullchain.pem` |
| Private Key                            | `/etc/letsencrypt/live/nahundfern.servuswir.de/privkey.pem`   |
| Host-Pfad (real)                       | `/var/lib/docker/volumes/nahundfern_letsencrypt/_data/...`    |

Verwendet werden sie durch `nginx/conf.d/site.conf`:

```
ssl_certificate     /etc/letsencrypt/live/nahundfern.servuswir.de/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/nahundfern.servuswir.de/privkey.pem;
```

**Nichts davon gehört ins Git-Repo.** Private Keys niemals committen.

---

## 4. Automatische Erneuerung

Der `certbot`-Service in `docker-compose.yml` läuft dauerhaft und ruft
alle 12 Stunden `certbot renew` auf:

```yaml
entrypoint: >
  /bin/sh -c "trap exit TERM;
  while :; do certbot renew --webroot -w /var/www/certbot --quiet;
  sleep 12h & wait $${!}; done;"
```

Let's Encrypt-Zertifikate haben 90 Tage Laufzeit; erneuert wird ab Tag 60.
Nach einer Erneuerung nginx neu laden, damit die neue Datei aktiv wird:

```bash
docker exec nahundfern-nginx nginx -s reload
```

Optional als täglicher Cron auf dem Host (`crontab -e`):

```
15 3 * * * docker exec nahundfern-nginx nginx -s reload >/dev/null 2>&1
```

Manueller Renewal-Test (dry-run, verbraucht kein Rate-Limit):

```bash
docker exec nahundfern-certbot certbot renew --dry-run
```

---

## 5. Backup / Restore

**Backup** (z. B. nach der Ersterstellung und dann monatlich):

```bash
docker run --rm \
  -v nahundfern_letsencrypt:/data \
  -v /root/backups:/backup \
  alpine tar czf /backup/letsencrypt-$(date +%F).tgz -C /data .
```

**Restore** auf neuem Server:

```bash
docker volume create nahundfern_letsencrypt
docker run --rm \
  -v nahundfern_letsencrypt:/data \
  -v /root/backups:/backup \
  alpine tar xzf /backup/letsencrypt-2026-07-12.tgz -C /data
```

---

## 6. Troubleshooting

| Symptom                                                   | Ursache                                    | Lösung                                                            |
| --------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------- |
| `nginx: [emerg] cannot load certificate ...fullchain.pem` | Zertifikat noch nicht erstellt             | Schritte 2.1–2.3 durchlaufen (nicht direkt `test4` starten)       |
| Certbot: `Timeout during connect`                         | Port 80 nicht erreichbar                   | Firewall / DNS prüfen                                             |
| Certbot: `DNS problem: NXDOMAIN`                          | A-Record fehlt/falsch                      | DNS beim Anbieter setzen, propagation abwarten                    |
| `too many certificates already issued`                    | Let's Encrypt Rate-Limit (5/Woche)         | `--dry-run` verwenden bzw. eine Woche warten                      |
| Zertifikat abgelaufen trotz certbot-Service               | nginx wurde nach Renewal nicht neu geladen | `docker exec nahundfern-nginx nginx -s reload` (bzw. Cron aus §4) |

---

## Kurzfassung

1. DNS auf Server-IP zeigen lassen, Ports 80/443 offen.
2. `./scripts/run.sh test3` → HTTP-only läuft.
3. Einmalig `certbot certonly --webroot ...` (Abschnitt 2.2).
4. `./scripts/stop.sh && ./scripts/run.sh test4` → Live mit HTTPS.
5. Zertifikate liegen im Docker-Volume `nahundfern_letsencrypt`
   (Container-Pfad `/etc/letsencrypt/live/nahundfern.servuswir.de/`).
6. Erneuerung erfolgt automatisch durch den `certbot`-Service alle 12 h.

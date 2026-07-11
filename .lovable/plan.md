# Anpassung auf User `deploy`

## Bestätigung

User `deploy` ist vollkommen in Ordnung. Wir passen nur Pfade und Besitzer an — am Docker-Setup selbst ändert sich nichts.

## Was sich ändert

| Vorher (Doku) | Neu |
|---------------|-----|
| `/opt/nahundfern` | `/opt/nahundfern` bleibt als Installationsverzeichnis, gehört aber `deploy` |
| User `nahundfern` | User `deploy` |
| `chown -R nahundfern:nahundfern` | `chown -R deploy:deploy` |

## Einmalige Einrichtung als root

Führe das jetzt auf dem Server aus:

```bash
# deploy gehört zu docker
groups deploy | grep -q docker || sudo usermod -aG docker deploy

# Verzeichnis anlegen und auf deploy überschreiben
sudo mkdir -p /opt/nahundfern
sudo chown -R deploy:deploy /opt/nahundfern
```

## Weiter als User deploy

```bash
su - deploy
cd /opt/nahundfern
git clone https://github.com/Softhuby99/Reiseblog.git .
cp .env.example .env
# .env bearbeiten
```

## Was ich im Code ändere

- `DEPLOYMENT.md`: Hinweis auf User `deploy` (statt `nahundfern`) und `/opt/nahundfern` als Installationspfad.
- `TEST.md` (falls angelegt): denselben User anpassen.
- `docker-compose.yml`: bleibt wie ist, Container-User bleibt `app` im Dockerfile.
- `scripts/start.sh`: prüft, ob Upload-Verzeichnisse beschreibbar sind, egal welcher Host-User.

## Frage

Soll ich jetzt die Dokumentation und ggf. ein HTTP-Test-Setup auf User `deploy` + `/opt/nahundfern` umstellen, oder willst du zuerst den aktuellen `main`-Branch auf dem Server bauen?

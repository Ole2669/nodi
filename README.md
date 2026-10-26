# Nodi

Lokale Anbindung an ein **Mediola Eva a.i.o. Gateway**: Codes lernen, Rollläden zuordnen, in **Home Assistant als Cover** steuern. Zeitpläne gehören in HA — Nodi hat keinen Scheduler.

Das ältere Projekt `Homes` bleibt unverändert.

## Voraussetzungen

- Node.js 22+
- Gateway im LAN (Default `http://192.168.178.38`)
- Für HA: Nodi-Bridge erreichbar (Default Port `8788`)

## Setup

```bash
cp .env.example .env   # optional
npm i
npm test
```

## Codes lernen (Meilenstein 1)

```bash
npm run cli -- ping
npm run cli -- learn living up --label Wohnzimmer
npm run cli -- learn living down --label Wohnzimmer
npm run cli -- list
npm run cli -- prepare living up
npm run cli -- send living up --yes
```

Pro Rollladen braucht HA **Hoch und Runter**. Codes: `data/codes.json`.

## Home Assistant (Meilenstein 2)

1. Bridge starten (auf dem Mac, der das Gateway erreicht):

```bash
# Wenn HA auf einem anderen Gerät läuft: LAN-IP des Macs setzen
# HA_BASE_URL=http://192.168.178.x:8788
npm run cli -- serve
```

2. YAML erzeugen und in HA einbinden (`configuration.yaml` oder `!include`):

```bash
npm run cli -- ha-yaml
```

3. HA: Config prüfen → REST commands + Template Entities neu laden (oder neu starten).

Cover-Mapping: HA `open`→`up`, `close`→`down`, `stop`→`stop`. Ohne Positionsfeedback (optimistic).

## API (Bridge)

| Methode | Pfad | Wirkung |
|---|---|---|
| GET | `/health` | Liveness |
| GET | `/api/covers` | Liste inkl. `ready` |
| POST | `/api/covers/:id/open\|close\|stop` | Send2 an Gateway |

Laufender `serve` = Send-Freigabe (kein CLI `--yes`).

## API-Grundlage Mediola

- Lernen: `GET /command?XC_FNC=Learn` (Community / FHEM)
- Senden: `GET /command?code=…&XC_FNC=Send2&ir=…&rf=…` (offizielle API)

Details: [`docs/gateway-api.md`](docs/gateway-api.md) · Spec: [`SPEC.md`](SPEC.md)

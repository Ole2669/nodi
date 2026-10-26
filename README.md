# Nodi

Lokale Anbindung an ein **Mediola Eva a.i.o. Gateway**: Fernbedienungscodes lernen, Rollläden zuordnen, gezielt senden. Home Assistant kommt in Meilenstein 2 — hier nur Learn & Send.

Das ältere Projekt `Homes` bleibt unverändert.

## Voraussetzungen

- Node.js 22+
- Gateway im LAN (Default `http://192.168.178.38`)

## Start

```bash
cp .env.example .env   # optional
npm i
npm test
npm run typecheck
```

## CLI

```bash
npm run cli -- ping
npm run cli -- learn living up --label Wohnzimmer
# → Handsender am Gateway drücken (Timeout 90s)

npm run cli -- list
npm run cli -- prepare living up    # zeigt Send2-URL, sendet nicht
npm run cli -- send living up --yes # echter Sendetest
```

Codes liegen in `data/codes.json`.

## API-Grundlage

- Lernen: `GET /command?XC_FNC=Learn` ([fhem-mediola](https://github.com/tobias-d-oe/fhem-mediola); nicht in der offiziellen PDF)
- Senden: `GET /command?code=…&XC_FNC=Send2&ir=…&rf=…` (offizielle Mediola-API)

Details und offene Eva-Checks: [`docs/gateway-api.md`](docs/gateway-api.md), Spec: [`SPEC.md`](SPEC.md).

## Nächster Meilenstein

Sobald ein Rollladen real angelernt und per `--yes` getestet ist: Home-Assistant Cover-Entitäten. Kein eigener Scheduler.

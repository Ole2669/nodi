# Spec: Nodi

## Objective

Lokale Mediola Eva a.i.o.-Anbindung: IR/RF-Codes lernen, Rollläden zuordnen, an Home Assistant als Cover-Entitäten exportieren. Zeitautomatisierung bleibt in HA. Kein eigener Scheduler, keine volle Smart-Home-UI.

## Tech Stack

- Node.js 22+, TypeScript, `tsx`
- Keine Runtime-Dependencies (eingebautes `node:http`)
- Persistenz: `data/codes.json`
- HA: `rest_command` + modernes `template:` Cover (kein MQTT)

## Commands

```bash
npm i
npm test
npm run typecheck
npm run cli -- ping
npm run cli -- learn <shutter> <up|down|stop>
npm run cli -- list
npm run cli -- prepare <shutter> <up|down|stop>
npm run cli -- send <shutter> <up|down|stop> --yes
npm run cli -- serve
npm run cli -- ha-yaml
```

## Project Structure

```
src/
  mediola/     Gateway-HTTP, Parser, Code-Extraktion
  ha/          Cover-Mapping + HA-YAML
  store.ts     Lokale Zuordnung Rollladen ↔ Code
  flow.ts      Learn-/Send-Orchestrierung
  server.ts    HTTP-Bridge für HA
  cli.ts       CLI
  config.ts    URL / Timeouts / Auth / Bridge
docs/
  gateway-api.md
```

## Cover-Mapping

| HA | Mediola-Richtung |
|---|---|
| open | up |
| close | down |
| stop | stop |

Cover-Entity nur wenn **open und close** angelernt. Stop optional.

## Testing Strategy

- Unit-/Integrationstests mit simuliertem Gateway und ephemeral HTTP-Port
- Send-CLI weiter nur mit `--yes`; Bridge-Send autorisiert durch laufenden Server

## Boundaries

- Always: Tests vor „fertig“; CLI-Send nur mit Bestätigung; `Homes` unangetastet
- Ask first: MQTT-Discovery, destruktive XC_FNC, Custom HA-Integration
- Never: eigener Scheduler; Annahmen über Eva ungeprüft

## Success Criteria

### Meilenstein 1
1. `npm test` grün mit simulierten Antworten
2. Learn → speichern → prepare → send `--yes`

### Meilenstein 2
1. `serve` exponiert `/api/covers` und `POST …/open|close|stop`
2. `ha-yaml` erzeugt gültiges modernes Template-YAML
3. In HA erscheinen ready Covers als `cover.*` (nach Include + Reload)
4. Kein Nodi-Scheduler

## Open Questions

- `HA_BASE_URL`: LAN-IP des Macs, wenn HA nicht lokal läuft
- Optional später: MQTT Discovery statt YAML

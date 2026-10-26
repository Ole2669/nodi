# Spec: Nodi — Meilenstein 1 (Learn & Send)

## Objective

Minimal, testbares Modul: Mediola Eva a.i.o. Gateway im LAN erreichen, Fernbedienungscode lernen, einem Rollladen + Richtung zuordnen, lokal speichern, Send2 vorbereiten und erst nach Bestätigung senden.

Meilenstein 2 (Home-Assistant Cover) startet erst nach erfolgreichem realen Lern-/Sendetest.

## Tech Stack

- Node.js 22+, TypeScript, `tsx`
- Keine Runtime-Dependencies
- Persistenz: `data/codes.json`

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
```

## Project Structure

```
src/
  mediola/     Gateway-HTTP, Parser, Code-Extraktion
  store.ts     Lokale Zuordnung Rollladen ↔ Code
  flow.ts      Learn-/Send-Orchestrierung (Bestätigung)
  cli.ts       Explizite Benutzeraktionen
  config.ts    URL / Timeouts / Auth
docs/
  gateway-api.md   Belegte vs. ungeprüfte API-Fakten
```

## Testing Strategy

- Unit-Tests mit simulierten Gateway-Antworten (kein echtes Gateway nötig)
- Abdecken: `{XC_SUC}` / `{XC_ERR}` / V5-JSON / ungültig / Timeout-Fehler / Code-Extraktion / Store / Send nur mit `--yes`

## Boundaries

- Always: Tests vor „fertig“; Send nur nach expliziter Bestätigung; altes Projekt `Homes` unangetastet
- Ask first: Home-Assistant-Integration, destruktive XC_FNC (`Del*`, `fEEPReset`, …)
- Never: Annahmen über Eva ungeprüft aus V5-/Elero-Pfaden übernehmen; Scheduler / volle UI

## Success Criteria

1. `npm test` grün mit simulierten Antworten
2. CLI kann Learn starten und erkannten Code speichern
3. `prepare` zeigt Send2-URL ohne zu senden
4. `send --yes` führt Send2 aus; ohne `--yes` Abbruch

## Open Questions (am echten Gateway prüfen)

- Exakte Learn-Antwortform auf Eva (V4-Prefix vs. V5-JSON)
- Ob Codes IR, RF oder beides sind → `ir`/`rf`-Defaults
- Ob `/command` vs. `/cmd` (Homes nutzt `/command`)

# Mediola Gateway — belegte API-Fakten (Nodi)

Quellen und was wir **nicht** ungeprüft übernehmen.

## Belegt: Send2 (offizielle API)

[API_AIO_GATEWAYS-All.pdf](https://www.mediola.com/support-docs/API_AIO_GATEWAYS-All.pdf):

```
GET /command?code=<MEDIOLA_CODE>&XC_FNC=Send2[&ir=<IR_ID>&rf=00]
```

- Mediola-Codes beginnen typisch mit `1908…` (älteres Format endet auf `001908`)
- `ir`: `01` intern, `02`/`04`/`08` externe Dioden; ohne Angabe → interne Dioden
- Optional Auth: `XC_USER` / `XC_PASS`
- Parameterreihenfolge laut Docs beachten (`code=` vor `XC_FNC=`)

Antwort-Stil V2–V4: `{XC_SUC}` / `{XC_ERR}` (+ optional JSON-Payload).

## Belegt in Community, nicht in der offiziellen PDF: Learn

[fhem-mediola](https://github.com/tobias-d-oe/fhem-mediola) (`77_MEDIOLA.pm`):

```
GET /command?XC_FNC=Learn
```

Danach Handsender ~30 cm am Gateway drücken; HTTP-Body enthält den erkannten Code.

Senden dort:

```
GET /command?XC_FNC=Send2&code=…&ir=…&rf=…
```

`ir`/`rf`-Attribute: `00|01|02|04|08`.

Homegear/misc dokumentiert zusätzlich V5-Form `{"XC_SUC":{"CODE":"…"}}` und Endpoint `/cmd` — **Eva in Homes nutzt `/command`**. Nodi defaultet auf `/command` und akzeptiert beide Antwortformen im Parser.

## Nicht der Lernpfad für IQONTROL-„Befehl lernen“

`learnSC` / `SendSC` gelten Systemkomponenten (HM, Elero `ER`, …). Das IQONTROL-Classic-IR/RF-Lernen entspricht `Learn` + `Send2`, nicht `learnSC`.

## Eva-spezifisch (noch am Gerät zu verifizieren)

| Annahme | Herkunft | Status |
|---|---|---|
| Basis-URL `/command` | Homes (`192.168.178.38`) | Default, am Gerät prüfen |
| Learn antwortet mit CODE | FHEM / Homegear | Parser tolerant; Gerätstest offen |
| Learn-Timeout ≫ normal | UX (Warten auf Taste) | Default 90 s vs. 4 s Ping/Send |
| IR vs. RF über `ir`/`rf` | Docs + FHEM | Pro Code speicherbar |

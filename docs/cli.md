# Nodi CLI and HTTP bridge

Optional Node.js tools for talking to a Mediola Eva a.i.o. gateway from a Mac or Linux host. Prefer the [Home Assistant custom integration](home-assistant.md) when you can install custom components — the CLI is useful for debugging, learning codes locally, or driving HA via an HTTP bridge without the component.

Requires **Node.js 22+** and a Mediola gateway on your LAN.

---

## Setup

```bash
git clone https://github.com/Ole2669/nodi.git
cd nodi
cp .env.example .env   # set GATEWAY_URL
npm install
npm test
npm run typecheck
```

Never commit `.env` or real `data/codes.json` (learned codes can control physical devices).

---

## Configuration

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `GATEWAY_URL` | yes | `http://mediola.local` | Mediola base URL |
| `XC_USER` | no | — | Gateway auth user |
| `XC_PASS` | no | — | Gateway auth password |
| `LEARN_TIMEOUT_MS` | no | `90000` | Learn HTTP timeout |
| `TIMEOUT_MS` | no | `4000` | Ping/send timeout |
| `NODI_HOST` | no | `127.0.0.1` | Bridge bind address |
| `NODI_PORT` | no | `8788` | Bridge port |
| `NODI_BRIDGE_TOKEN` | recommended if non-loopback | — | Bearer token for bridge API |
| `HA_BASE_URL` | no | `http://127.0.0.1:8788` | URL HA uses to reach the bridge |

Use placeholders only in examples — never real credentials.

---

## Quick start

```bash
npm run cli -- ping
npm run cli -- learn living up --label "Living room"
npm run cli -- learn living down --label "Living room"
npm run cli -- list
npm run cli -- prepare living up      # prints Send2 URL (auth redacted); does not send
npm run cli -- send living up --yes  # transmits
```

Codes are stored in `data/codes.json` (gitignored).

---

## Commands

```bash
npm run cli -- help
npm run cli -- ping
npm run cli -- learn <shutter> <up|down|stop> [--label Name] [--ir 01] [--rf 00]
npm run cli -- list [--short]
npm run cli -- remove <shutter> [up|down|stop]
npm run cli -- prepare <shutter> <up|down|stop>
npm run cli -- send <shutter> <up|down|stop> --yes
npm run cli -- serve
npm run cli -- ha-yaml
```

| Rule | Detail |
|---|---|
| Send confirmation | CLI `send` always needs `--yes` |
| Bridge send | Starting `serve` is the authorization boundary (no `--yes`); protect with `NODI_BRIDGE_TOKEN` if not loopback-only |
| Cover readiness | HA-style covers need **up** and **down** learned; stop is optional |

---

## HTTP bridge (alternative to the custom component)

Run a small HTTP server that Home Assistant can call via `rest_command` + template covers.

```bash
# Trusted LAN + token recommended:
# NODI_HOST=0.0.0.0 NODI_BRIDGE_TOKEN=change-me HA_BASE_URL=http://YOUR_LAN_IP:8788
npm run serve
npm run cli -- ha-yaml   # review output, then merge into configuration.yaml
```

Endpoints:

| Method | Path | Notes |
|---|---|---|
| `GET` | `/health` | No token required |
| `GET` | `/api/covers` | Lists ready/incomplete covers |
| `POST` | `/api/covers/:id/{open\|close\|stop}` | Sends the mapped Mediola code |

When `NODI_BRIDGE_TOKEN` is set, `/api/*` requires `Authorization: Bearer <token>`. `ha-yaml` embeds that header in generated `rest_command` entries.

Default bind is `127.0.0.1`. Only use `0.0.0.0` on a trusted LAN, and set a token.

---

## Development commands

```bash
npm test
npm run typecheck
npm run cli -- help
```

Tests use a simulated gateway and an ephemeral HTTP port (`node:test` via `tsx`).

---

## Troubleshooting

| Symptom | What to check |
|---|---|
| Cannot reach gateway | `GATEWAY_URL`, LAN routing, Mediola web UI |
| Learn times out | Press remote ~30 cm from gateway within ~90 s; increase `LEARN_TIMEOUT_MS` |
| Send refused | Pass `--yes` |
| Bridge 401 | Matching `NODI_BRIDGE_TOKEN`; regenerate YAML after changing the token |
| Bridge unreachable from HA | `HA_BASE_URL` = LAN IP of the bridge host; `NODI_HOST=0.0.0.0` only with a token |
| Incomplete cover in YAML | Learn both `up` and `down` for that shutter |

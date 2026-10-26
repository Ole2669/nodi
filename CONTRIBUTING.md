# Contributing to Nodi

Thanks for helping improve Nodi. This project has two surfaces: a Node.js CLI/bridge and a Home Assistant custom integration.

## Development setup

### Node (CLI / bridge)

Requirements: Node.js 22+.

```bash
git clone https://github.com/Ole2669/nodi.git
cd nodi
cp .env.example .env
npm install
npm test
npm run typecheck
```

Use a simulated gateway in tests; point `.env` at a real Mediola only for manual checks on your LAN.

### Home Assistant component

The integration lives in `custom_components/nodi`. Install it onto a test HA instance with:

```bash
./scripts/install-ha.sh user@ha-host /path/to/ha/config
```

Restart Home Assistant after copying. There is no Python test suite in this repository yet.

## Coding standards

- TypeScript: strict mode (`tsconfig.json`); ESM with `.js` import suffixes
- Prefer small, readable changes; avoid new dependencies unless necessary
- User-facing and developer-facing text: clear English (HA UI may keep `translations/de.json` for localization)
- Do not commit `.env`, `data/codes.json`, real IR/RF codes, or credentials
- CLI send must remain gated by `--yes`; bridge send remains gated by a running server (and optional `NODI_BRIDGE_TOKEN`)

## Workflow

1. Open an issue for non-trivial changes when possible
2. Create a branch from `main`
3. Keep commits focused
4. Ensure `npm test` and `npm run typecheck` pass
5. Open a pull request using the template

Commit messages: imperative mood, short summary (e.g. `Fix learn timeout handling`).

## Pull requests

- Describe what changed and why
- Note breaking changes and docs updates
- Include the test commands you ran
- Do not paste secrets, full learned codes from production homes, or private LAN details beyond generic examples

## Bugs and features

- Bugs: use the Bug report issue template (repro steps, expected vs actual, versions)
- Features: use the Feature request template; say whether the change is CLI, HA integration, or both

## Documentation

Update the README or `docs/` when behavior or setup steps change. Keep examples copy-pasteable and free of real credentials.

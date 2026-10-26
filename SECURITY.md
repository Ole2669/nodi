# Security Policy

## Supported versions

This project is pre-1.0. Security fixes are applied on the latest `main` branch only unless a release tag is published later.

| Version | Supported |
|---|---|
| `main` / 0.x | Yes |

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security problems that could:

- Expose gateway credentials or bridge tokens
- Allow unauthorized shutter control on a LAN
- Leak learned IR/RF codes from someone else’s home

Prefer one of these private channels:

1. **GitHub Security Advisories** for this repository (recommended when the repo is on GitHub with advisories enabled)
2. Contact the repository owner via GitHub: [@Ole2669](https://github.com/Ole2669)

### What to include

- Affected component (CLI, HTTP bridge, HA integration)
- Nodi version or commit SHA
- Description of the issue and impact
- Steps to reproduce (without real credentials or production codes)
- Any suggested fix

You should receive an acknowledgement when the maintainer is available. There is no guaranteed SLA yet for this early project.

## Security notes for operators

- Learned codes can control physical devices — treat `data/codes.json` and HA storage as sensitive
- The optional HTTP bridge can send codes without CLI `--yes`; bind to loopback by default, and set `NODI_BRIDGE_TOKEN` if listening on a LAN interface
- Gateway `XC_USER` / `XC_PASS` appear in Mediola query strings; CLI output redacts them, but avoid sharing raw prepare URLs from older builds
- Keep Mediola and Home Assistant on a trusted network segment

## Git history note

Early commits included private LAN addresses in `.env.example` and README examples (since replaced with `mediola.local` / placeholders in the working tree). No gateway passwords or learned codes were found in history during the open-source prep review.

If this repository is published publicly and those historical addresses are considered sensitive, rotate any related network assumptions as needed and consider a **one-time history rewrite** (e.g. `git filter-repo`) **only with explicit maintainer approval**, followed by force-push coordination with every clone. Do not rewrite shared history casually.

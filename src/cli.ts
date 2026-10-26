#!/usr/bin/env node
import { loadConfig } from "./config.js";
import {
  learnAndAssign,
  pingGateway,
  prepareSend,
  sendConfirmed,
} from "./flow.js";
import type { Direction, IrRfId } from "./mediola/types.js";
import { loadStore, storePath } from "./store.js";

const DIRECTIONS = new Set<Direction>(["up", "down", "stop"]);

async function main(argv: string[]): Promise<number> {
  const [cmd, ...rest] = argv;
  const cfg = loadConfig();

  if (!cmd || cmd === "help" || cmd === "-h" || cmd === "--help") {
    printHelp();
    return 0;
  }

  if (cmd === "ping") {
    const out = await pingGateway(cfg);
    console.log(out.message);
    return out.ok ? 0 : 1;
  }

  if (cmd === "list") {
    const store = loadStore(cfg.dataDir);
    const ids = Object.keys(store.shutters);
    if (ids.length === 0) {
      console.log(`Keine Codes in ${storePath(cfg.dataDir)}`);
      return 0;
    }
    for (const id of ids) {
      const s = store.shutters[id]!;
      console.log(`${s.id} (${s.label})`);
      for (const dir of ["up", "down", "stop"] as Direction[]) {
        const c = s.codes[dir];
        if (!c) continue;
        console.log(
          `  ${dir}: ${c.code.slice(0, 24)}… medium=${c.medium} ir=${c.ir} rf=${c.rf}`,
        );
      }
    }
    return 0;
  }

  if (cmd === "learn") {
    const shutter = rest[0];
    const direction = rest[1] as Direction | undefined;
    if (!shutter || !direction || !DIRECTIONS.has(direction)) {
      console.error("Usage: nodi learn <shutter> <up|down|stop> [--label Name] [--ir 01] [--rf 00]");
      return 2;
    }
    const label = flagValue(rest, "--label");
    const ir = flagValue(rest, "--ir") as IrRfId | undefined;
    const rf = flagValue(rest, "--rf") as IrRfId | undefined;
    console.log(
      `Lernmodus (${cfg.learnTimeoutMs} ms Timeout) — Handsender am Gateway drücken…`,
    );
    const out = await learnAndAssign(cfg, shutter, direction, { label, ir, rf });
    console.log(out.message);
    if (out.learned) console.log(`Code: ${out.learned.code}`);
    return out.ok ? 0 : 1;
  }

  if (cmd === "prepare") {
    const shutter = rest[0];
    const direction = rest[1] as Direction | undefined;
    if (!shutter || !direction || !DIRECTIONS.has(direction)) {
      console.error("Usage: nodi prepare <shutter> <up|down|stop>");
      return 2;
    }
    const out = prepareSend(cfg, shutter, direction);
    console.log(out.message);
    if (out.sendUrl) console.log(out.sendUrl);
    return out.ok ? 0 : 1;
  }

  if (cmd === "send") {
    const shutter = rest[0];
    const direction = rest[1] as Direction | undefined;
    if (!shutter || !direction || !DIRECTIONS.has(direction)) {
      console.error("Usage: nodi send <shutter> <up|down|stop> --yes");
      return 2;
    }
    const confirm = rest.includes("--yes");
    const out = await sendConfirmed(cfg, shutter, direction, confirm);
    console.log(out.message);
    return out.ok ? 0 : 1;
  }

  console.error(`Unbekannter Befehl: ${cmd}`);
  printHelp();
  return 2;
}

function flagValue(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  if (i < 0) return undefined;
  return args[i + 1];
}

function printHelp(): void {
  console.log(`nodi — Mediola Learn & Send (Meilenstein 1)

  ping
  learn <shutter> <up|down|stop> [--label Name] [--ir 01] [--rf 00]
  list
  prepare <shutter> <up|down|stop>
  send <shutter> <up|down|stop> --yes

Gateway: GATEWAY_URL (Default http://192.168.178.38)
Codes:   data/codes.json
Docs:    docs/gateway-api.md
`);
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);

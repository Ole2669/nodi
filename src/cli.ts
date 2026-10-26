#!/usr/bin/env node
import { loadConfig } from "./config.js";
import {
  learnAndAssign,
  pingGateway,
  prepareSend,
  sendConfirmed,
} from "./flow.js";
import { coverInfo, listCovers } from "./ha/covers.js";
import { generateHaYaml } from "./ha/yaml.js";
import type { Direction, IrRfId } from "./mediola/types.js";
import { startCoverServer } from "./server.js";
import { loadStore, removeCode, saveStore, storePath } from "./store.js";

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
    const short = rest.includes("--short");
    const store = loadStore(cfg.dataDir);
    const ids = Object.keys(store.shutters);
    if (ids.length === 0) {
      console.log(`No learned commands in ${storePath(cfg.dataDir)}`);
      return 0;
    }
    console.log(`Learned in: ${storePath(cfg.dataDir)}`);
    for (const id of ids) {
      const s = store.shutters[id]!;
      const info = coverInfo(s);
      const ha = info.ready ? "HA ready" : "HA incomplete (needs up+down)";
      console.log(`\n${s.id} — ${s.label} [${ha}]`);
      for (const dir of ["up", "down", "stop"] as Direction[]) {
        const c = s.codes[dir];
        const dirLabel =
          dir === "up" ? "Up (up)" : dir === "down" ? "Down (down)" : "Stop (stop)";
        if (!c) {
          console.log(`  ${dirLabel}: (not learned)`);
          continue;
        }
        const code = short ? `${c.code.slice(0, 32)}… (${c.code.length} chars)` : c.code;
        console.log(`  ${dirLabel}:`);
        console.log(`    Code:    ${code}`);
        console.log(`    Channel: ir=${c.ir}  rf=${c.rf}  medium=${c.medium}`);
        console.log(`    Learned: ${c.learnedAt}`);
      }
    }
    console.log("");
    return 0;
  }

  if (cmd === "remove" || cmd === "rm" || cmd === "delete") {
    const shutter = rest[0];
    const direction = rest[1] as Direction | undefined;
    if (!shutter) {
      console.error("Usage: nodi remove <shutter> [up|down|stop]");
      console.error("  omit direction → remove entire shutter");
      return 2;
    }
    if (direction != null && !DIRECTIONS.has(direction)) {
      console.error("Direction: up|down|stop (or omit for all)");
      return 2;
    }
    const result = removeCode(loadStore(cfg.dataDir), shutter, direction);
    if (!result) {
      console.error(
        direction
          ? `Nothing to remove: "${shutter}" ${direction}`
          : `Unknown shutter: ${shutter}`,
      );
      return 1;
    }
    saveStore(cfg.dataDir, result.store);
    console.log(`Removed: ${result.removed}`);
    console.log("Note: regenerate HA YAML and update Home Assistant if needed.");
    return 0;
  }

  if (cmd === "learn") {
    const shutter = rest[0];
    const direction = rest[1] as Direction | undefined;
    if (!shutter || !direction || !DIRECTIONS.has(direction)) {
      console.error(
        "Usage: nodi learn <shutter> <up|down|stop> [--label Name] [--ir 01] [--rf 00]",
      );
      return 2;
    }
    const label = flagValue(rest, "--label");
    const ir = flagValue(rest, "--ir") as IrRfId | undefined;
    const rf = flagValue(rest, "--rf") as IrRfId | undefined;
    console.log(
      `Learn mode (${cfg.learnTimeoutMs} ms timeout) — press remote near gateway…`,
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

  if (cmd === "ha-yaml") {
    const covers = listCovers(loadStore(cfg.dataDir));
    process.stdout.write(
      generateHaYaml(covers, cfg.haBaseUrl, { bridgeToken: cfg.bridgeToken }),
    );
    return 0;
  }

  if (cmd === "serve") {
    const srv = await startCoverServer({
      cfg,
      host: cfg.serveHost,
      port: cfg.servePort,
    });
    console.log(
      `Nodi cover bridge http://${srv.host === "0.0.0.0" ? "0.0.0.0" : srv.host}:${srv.port}`,
    );
    console.log(`HA reaches bridge at: ${cfg.haBaseUrl}`);
    if (cfg.bridgeToken) {
      console.log("Bridge auth: NODI_BRIDGE_TOKEN required (Bearer).");
    } else if (cfg.serveHost === "0.0.0.0" || cfg.serveHost === "::") {
      console.warn(
        "Warning: bridge listens on all interfaces without NODI_BRIDGE_TOKEN — LAN-trusted only.",
      );
    }
    console.log("Send authorization: running server (no --yes needed).");
    console.log("YAML: npm run cli -- ha-yaml");
    await new Promise<void>((resolve) => {
      const stop = () => {
        void srv.close().finally(resolve);
      };
      process.once("SIGINT", stop);
      process.once("SIGTERM", stop);
    });
    return 0;
  }

  console.error(`Unknown command: ${cmd}`);
  printHelp();
  return 2;
}

function flagValue(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  if (i < 0) return undefined;
  return args[i + 1];
}

function printHelp(): void {
  console.log(`nodi — Mediola Learn & Send + HA covers

  ping
  learn <shutter> <up|down|stop> [--label Name] [--ir 01] [--rf 00]
  list [--short]     learned commands (full code; --short = truncated)
  remove <shutter> [up|down|stop]
                     remove one direction or the entire shutter
  prepare <shutter> <up|down|stop>
  send <shutter> <up|down|stop> --yes
  serve              HTTP bridge for Home Assistant
  ha-yaml            configuration.yaml snippet (stdout)

Gateway: GATEWAY_URL (default http://mediola.local)
Bridge:  NODI_HOST / NODI_PORT (default 127.0.0.1:8788)
Auth:    NODI_BRIDGE_TOKEN (optional Bearer token for serve)
HA URL:  HA_BASE_URL (default http://127.0.0.1:8788)
Codes:   data/codes.json (gitignored; local only)
`);
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);

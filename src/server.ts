import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { NodiConfig } from "./config.js";
import { sendConfirmed } from "./flow.js";
import {
  listCovers,
  resolveCoverAction,
  type CoverAction,
} from "./ha/covers.js";
import { loadStore } from "./store.js";

const ACTIONS = new Set<CoverAction>(["open", "close", "stop"]);

export type ServerOptions = {
  cfg: NodiConfig;
  host?: string;
  port?: number;
  /** Injected for tests. */
  fetchImpl?: typeof fetch;
};

/**
 * Minimal HTTP bridge for Home Assistant.
 * Starting this process is the send authorization boundary (no CLI --yes).
 */
export function startCoverServer(opts: ServerOptions): Promise<{
  host: string;
  port: number;
  close: () => Promise<void>;
}> {
  const host = opts.host ?? "127.0.0.1";
  const port = opts.port ?? Number(process.env.NODI_PORT ?? 8788);

  const server = createServer((req, res) => {
    void handle(req, res, opts).catch((err) => {
      json(res, 500, { ok: false, message: String(err) });
    });
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      const addr = server.address();
      const bound =
        addr && typeof addr === "object" ? addr.port : port;
      resolve({
        host,
        port: bound,
        close: () =>
          new Promise((r, j) => server.close((e) => (e ? j(e) : r()))),
      });
    });
  });
}

async function handle(
  req: IncomingMessage,
  res: ServerResponse,
  opts: ServerOptions,
): Promise<void> {
  const url = new URL(req.url ?? "/", `http://${opts.host ?? "127.0.0.1"}`);
  const method = req.method ?? "GET";

  if (method === "GET" && url.pathname === "/health") {
    json(res, 200, { ok: true, service: "nodi" });
    return;
  }

  if (method === "GET" && url.pathname === "/api/covers") {
    json(res, 200, { ok: true, covers: listCovers(loadStore(opts.cfg.dataDir)) });
    return;
  }

  const match = url.pathname.match(
    /^\/api\/covers\/([^/]+)\/(open|close|stop)$/,
  );
  if (method === "POST" && match) {
    const shutterId = decodeURIComponent(match[1]!);
    const action = match[2] as CoverAction;
    if (!ACTIONS.has(action)) {
      json(res, 400, { ok: false, message: "action: open|close|stop" });
      return;
    }

    const resolved = resolveCoverAction(
      loadStore(opts.cfg.dataDir),
      shutterId,
      action,
    );
    if (!resolved.ok) {
      json(res, 404, { ok: false, message: resolved.error });
      return;
    }

    const out = await sendConfirmed(
      opts.cfg,
      shutterId,
      resolved.direction,
      true,
      opts.fetchImpl,
    );
    json(res, out.ok ? 200 : 502, {
      ok: out.ok,
      message: out.message,
      shutter: shutterId,
      action,
      direction: resolved.direction,
    });
    return;
  }

  json(res, 404, { ok: false, message: "Not found" });
}

function json(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

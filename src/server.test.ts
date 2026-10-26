import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import type { NodiConfig } from "./config.js";
import { startCoverServer } from "./server.js";
import { assignCode, saveStore, type CodeStore } from "./store.js";

const CODE_UP =
  "19082601000200000100DE58800101010000000000000100000000";
const CODE_DOWN =
  "19082601000200000100DE58800101010000000000000100000001";

describe("cover server", () => {
  const dir = mkdtempSync(join(tmpdir(), "nodi-srv-"));
  after(() => rmSync(dir, { recursive: true, force: true }));

  it("lists covers and sends on POST open", async () => {
    let store: CodeStore = { version: 1, shutters: {} };
    const base = {
      ir: "01" as const,
      rf: "00" as const,
      medium: "unknown" as const,
      learnedAt: "2026-01-01T00:00:00.000Z",
    };
    store = assignCode(store, "living", "up", { ...base, code: CODE_UP }, "Wohnzimmer");
    store = assignCode(store, "living", "down", { ...base, code: CODE_DOWN });
    saveStore(dir, store);

    const cfg: NodiConfig = {
      gatewayUrl: "http://gw.local",
      timeoutMs: 1000,
      learnTimeoutMs: 1000,
      dataDir: dir,
      serveHost: "127.0.0.1",
      servePort: 0,
      haBaseUrl: "http://127.0.0.1",
    };

    const sent: string[] = [];
    const fetchImpl = (async (input: RequestInfo | URL) => {
      sent.push(String(input));
      return new Response("{XC_SUC}", { status: 200 });
    }) as typeof fetch;

    const srv = await startCoverServer({
      cfg,
      host: "127.0.0.1",
      port: 0,
      fetchImpl,
    });

    try {
      const baseUrl = `http://127.0.0.1:${srv.port}`;

      const health = await fetch(`${baseUrl}/health`);
      assert.equal(health.status, 200);

      const list = await fetch(`${baseUrl}/api/covers`);
      const listBody = (await list.json()) as {
        covers: { id: string; ready: boolean }[];
      };
      assert.equal(listBody.covers[0]?.id, "living");
      assert.equal(listBody.covers[0]?.ready, true);

      const open = await fetch(`${baseUrl}/api/covers/living/open`, {
        method: "POST",
      });
      const openBody = (await open.json()) as { ok: boolean; direction: string };
      assert.equal(open.status, 200);
      assert.equal(openBody.ok, true);
      assert.equal(openBody.direction, "up");
      assert.equal(sent.length, 1);
      assert.match(sent[0]!, /XC_FNC=Send2/);
      assert.match(sent[0]!, /code=/);

      const missing = await fetch(`${baseUrl}/api/covers/living/stop`, {
        method: "POST",
      });
      assert.equal(missing.status, 404);
    } finally {
      await srv.close();
    }
  });
});

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import type { NodiConfig } from "./config.js";
import { learnAndAssign, prepareSend, sendConfirmed } from "./flow.js";

const CODE =
  "19082601000200000100DE58800101010000000000000100000000";

function cfg(dataDir: string): NodiConfig {
  return {
    gatewayUrl: "http://gw.local",
    timeoutMs: 1000,
    learnTimeoutMs: 1000,
    dataDir,
    serveHost: "127.0.0.1",
    servePort: 8788,
    haBaseUrl: "http://127.0.0.1:8788",
  };
}

function mockFetch(body: string): typeof fetch {
  return (async () => new Response(body, { status: 200 })) as typeof fetch;
}

describe("flow", () => {
  it("learnAndAssign stores code; prepare builds URL; send needs --yes", async () => {
    const dir = mkdtempSync(join(tmpdir(), "nodi-flow-"));
    try {
      const c = cfg(dir);
      const learned = await learnAndAssign(c, "kitchen", "down", {
        fetchImpl: mockFetch(`{XC_SUC}{"CODE":"${CODE}"}`),
      });
      assert.equal(learned.ok, true);
      assert.equal(learned.learned?.code, CODE.toUpperCase());

      const prep = prepareSend(c, "kitchen", "down");
      assert.equal(prep.ok, true);
      assert.match(prep.sendUrl ?? "", /XC_FNC=Send2/);
      assert.ok((prep.sendUrl ?? "").includes("code="));

      const denied = await sendConfirmed(c, "kitchen", "down", false);
      assert.equal(denied.ok, false);
      assert.match(denied.message, /Bestätigung fehlt/);

      const sent = await sendConfirmed(
        c,
        "kitchen",
        "down",
        true,
        mockFetch("{XC_SUC}"),
      );
      assert.equal(sent.ok, true);
      assert.match(sent.message, /Send2 akzeptiert/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects invalid learn payload", async () => {
    const dir = mkdtempSync(join(tmpdir(), "nodi-flow-"));
    try {
      const out = await learnAndAssign(cfg(dir), "x", "up", {
        fetchImpl: mockFetch("{XC_SUC}{\"hello\":1}"),
      });
      assert.equal(out.ok, false);
      assert.match(out.message, /Kein gültiger Code/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

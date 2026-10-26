import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  assignCode,
  channelsForMedium,
  getCode,
  loadStore,
  removeCode,
  saveStore,
} from "./store.js";

describe("store", () => {
  it("persists shutter code assignment", () => {
    const dir = mkdtempSync(join(tmpdir(), "nodi-"));
    try {
      let store = loadStore(dir);
      store = assignCode(
        store,
        "living",
        "up",
        {
          code: "19082601000200000100DE58800101010000000000000100000000",
          ir: "00",
          rf: "01",
          medium: "rf",
          learnedAt: "2026-01-01T00:00:00.000Z",
        },
        "Living room",
      );
      saveStore(dir, store);
      const loaded = loadStore(dir);
      const entry = getCode(loaded, "living", "up");
      assert.ok(entry);
      assert.equal(loaded.shutters.living?.label, "Living room");
      assert.equal(entry!.rf, "01");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("channelsForMedium picks IR/RF defaults", () => {
    assert.deepEqual(channelsForMedium("ir"), { ir: "01", rf: "00" });
    assert.deepEqual(channelsForMedium("rf"), { ir: "00", rf: "01" });
  });

  it("removeCode drops one direction or whole shutter", () => {
    let store = assignCode(
      { version: 1, shutters: {} },
      "living",
      "up",
      {
        code: "19082601000200000100DE58800101010000000000000100000000",
        ir: "01",
        rf: "00",
        medium: "unknown",
        learnedAt: "2026-01-01T00:00:00.000Z",
      },
    );
    store = assignCode(store, "living", "down", {
      code: "19082601000200000100DE58800101010000000000000100000001",
      ir: "01",
      rf: "00",
      medium: "unknown",
      learnedAt: "2026-01-01T00:00:00.000Z",
    });

    const one = removeCode(store, "living", "up");
    assert.ok(one);
    assert.equal(getCode(one!.store, "living", "up"), null);
    assert.ok(getCode(one!.store, "living", "down"));

    const all = removeCode(one!.store, "living");
    assert.ok(all);
    assert.equal(all!.store.shutters.living, undefined);
  });
});

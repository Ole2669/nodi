import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CodeStore } from "../store.js";
import { listCovers, resolveCoverAction } from "./covers.js";
import { entityId, generateHaYaml, restKey } from "./yaml.js";

const store: CodeStore = {
  version: 1,
  shutters: {
    living: {
      id: "living",
      label: "Living room",
      codes: {
        up: {
          code: "19082601000200000100DE58800101010000000000000100000000",
          ir: "01",
          rf: "00",
          medium: "unknown",
          learnedAt: "2026-01-01T00:00:00.000Z",
        },
        down: {
          code: "19082601000200000100DE58800101010000000000000100000001",
          ir: "01",
          rf: "00",
          medium: "unknown",
          learnedAt: "2026-01-01T00:00:00.000Z",
        },
      },
    },
    kitchen: {
      id: "kitchen",
      label: "Kitchen",
      codes: {
        up: {
          code: "19082601000200000100DE58800101010000000000000100000002",
          ir: "01",
          rf: "00",
          medium: "unknown",
          learnedAt: "2026-01-01T00:00:00.000Z",
        },
      },
    },
  },
};

describe("covers", () => {
  it("marks ready only when open+close exist", () => {
    const covers = listCovers(store);
    assert.equal(covers.find((c) => c.id === "living")?.ready, true);
    assert.equal(covers.find((c) => c.id === "kitchen")?.ready, false);
  });

  it("maps open/close to up/down", () => {
    const open = resolveCoverAction(store, "living", "open");
    assert.equal(open.ok, true);
    if (open.ok) assert.equal(open.direction, "up");

    const missing = resolveCoverAction(store, "kitchen", "close");
    assert.equal(missing.ok, false);
  });
});

describe("generateHaYaml", () => {
  it("emits modern template covers for ready shutters only", () => {
    const yaml = generateHaYaml(listCovers(store), "http://127.0.0.1:8788");
    assert.match(yaml, /rest_command:/);
    assert.match(yaml, /template:/);
    assert.match(yaml, /unique_id: nodi_living/);
    assert.match(yaml, /device_class: shutter/);
    assert.match(yaml, /action: rest_command\.nodi_living_open/);
    assert.match(yaml, /action: rest_command\.nodi_living_close/);
    assert.match(yaml, /incomplete/);
    assert.match(yaml, /kitchen/);
    assert.doesNotMatch(yaml, /unique_id: nodi_kitchen/);
    assert.match(
      yaml,
      /url: "http:\/\/127\.0\.0\.1:8788\/api\/covers\/living\/open"/,
    );
  });

  it("entityId sanitizes", () => {
    assert.equal(entityId("Living Room"), "nodi_living_room");
    assert.equal(restKey("living", "open"), "nodi_living_open");
  });

  it("includes Authorization when bridgeToken is set", () => {
    const yaml = generateHaYaml(listCovers(store), "http://127.0.0.1:8788", {
      bridgeToken: "secret",
    });
    assert.match(yaml, /Authorization: Bearer secret/);
  });
});

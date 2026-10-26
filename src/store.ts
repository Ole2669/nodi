import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Direction, IrRfId } from "./mediola/types.js";

export type StoredCode = {
  code: string;
  ir: IrRfId;
  rf: IrRfId;
  medium: "ir" | "rf" | "unknown";
  learnedAt: string;
};

export type ShutterRecord = {
  id: string;
  label: string;
  codes: Partial<Record<Direction, StoredCode>>;
};

export type CodeStore = {
  version: 1;
  shutters: Record<string, ShutterRecord>;
};

const EMPTY: CodeStore = { version: 1, shutters: {} };

export function storePath(dataDir: string): string {
  return join(dataDir, "codes.json");
}

export function loadStore(dataDir: string): CodeStore {
  const path = storePath(dataDir);
  if (!existsSync(path)) return structuredClone(EMPTY);
  const raw = JSON.parse(readFileSync(path, "utf8")) as CodeStore;
  if (raw.version !== 1 || typeof raw.shutters !== "object") {
    throw new Error(`Invalid store: ${path}`);
  }
  return raw;
}

export function saveStore(dataDir: string, store: CodeStore): void {
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(storePath(dataDir), JSON.stringify(store, null, 2) + "\n", "utf8");
}

export function assignCode(
  store: CodeStore,
  shutterId: string,
  direction: Direction,
  entry: StoredCode,
  label?: string,
): CodeStore {
  const id = shutterId.trim();
  if (!id) throw new Error("shutterId missing");
  const next = structuredClone(store);
  const existing = next.shutters[id];
  next.shutters[id] = {
    id,
    label: label?.trim() || existing?.label || id,
    codes: { ...(existing?.codes ?? {}), [direction]: entry },
  };
  return next;
}

export function getCode(
  store: CodeStore,
  shutterId: string,
  direction: Direction,
): StoredCode | null {
  return store.shutters[shutterId]?.codes[direction] ?? null;
}

export function removeCode(
  store: CodeStore,
  shutterId: string,
  direction?: Direction,
): { store: CodeStore; removed: string } | null {
  const existing = store.shutters[shutterId];
  if (!existing) return null;

  const next = structuredClone(store);

  if (!direction) {
    delete next.shutters[shutterId];
    return { store: next, removed: `shutter "${shutterId}" fully removed` };
  }

  if (!existing.codes[direction]) return null;
  delete next.shutters[shutterId]!.codes[direction];
  const left = Object.keys(next.shutters[shutterId]!.codes);
  if (left.length === 0) {
    delete next.shutters[shutterId];
    return {
      store: next,
      removed: `"${shutterId}" ${direction} (empty → removed)`,
    };
  }
  return { store: next, removed: `"${shutterId}" ${direction}` };
}

export function channelsForMedium(medium: "ir" | "rf" | "unknown"): {
  ir: IrRfId;
  rf: IrRfId;
} {
  if (medium === "rf") return { ir: "00", rf: "01" };
  if (medium === "ir") return { ir: "01", rf: "00" };

  return { ir: "01", rf: "00" };
}

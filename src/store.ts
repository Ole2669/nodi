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
    throw new Error(`Ungültiger Store: ${path}`);
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
  if (!id) throw new Error("shutterId fehlt");
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

/** Defaults for Send2 from guessed medium. */
export function channelsForMedium(medium: "ir" | "rf" | "unknown"): {
  ir: IrRfId;
  rf: IrRfId;
} {
  if (medium === "rf") return { ir: "00", rf: "01" };
  if (medium === "ir") return { ir: "01", rf: "00" };
  // Unknown: prefer internal IR diode; override via store edit if RF.
  return { ir: "01", rf: "00" };
}

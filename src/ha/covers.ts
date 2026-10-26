import type { Direction } from "../mediola/types.js";
import type { CodeStore, ShutterRecord } from "../store.js";

export type CoverAction = "open" | "close" | "stop";

/** HA cover action → stored Mediola direction. */
export const ACTION_TO_DIRECTION: Record<CoverAction, Direction> = {
  open: "up",
  close: "down",
  stop: "stop",
};

export type CoverInfo = {
  id: string;
  name: string;
  actions: CoverAction[];
  /** Ready for HA when open + close exist (stop optional). */
  ready: boolean;
};

export function listCovers(store: CodeStore): CoverInfo[] {
  return Object.values(store.shutters)
    .map(coverInfo)
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function coverInfo(shutter: ShutterRecord): CoverInfo {
  const actions = (Object.keys(ACTION_TO_DIRECTION) as CoverAction[]).filter(
    (action) => shutter.codes[ACTION_TO_DIRECTION[action]] != null,
  );
  return {
    id: shutter.id,
    name: shutter.label || shutter.id,
    actions,
    ready: actions.includes("open") && actions.includes("close"),
  };
}

export function resolveCoverAction(
  store: CodeStore,
  shutterId: string,
  action: CoverAction,
): { ok: true; direction: Direction; name: string } | { ok: false; error: string } {
  const shutter = store.shutters[shutterId];
  if (!shutter) {
    return { ok: false, error: `Unbekannter Rollladen: ${shutterId}` };
  }
  const direction = ACTION_TO_DIRECTION[action];
  if (!shutter.codes[direction]) {
    return {
      ok: false,
      error: `Kein Code für „${shutterId}“ ${action} (${direction}) — zuerst learn`,
    };
  }
  return { ok: true, direction, name: shutter.label || shutter.id };
}

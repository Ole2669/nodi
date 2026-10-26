import type { LearnedCode, ParseResult } from "./types.js";

const SUC = "{XC_SUC}";
const ERR = "{XC_ERR}";

/**
 * Accept classic `{XC_SUC}…` / `{XC_ERR}…` and V5-style `{"XC_SUC":…}`.
 */
export function parseMediolaResponse(raw: string): ParseResult {
  const text = raw.trim();
  if (!text) {
    return { ok: false, raw, payload: "", error: "Leere Gateway-Antwort" };
  }

  if (text.startsWith(SUC)) {
    const payload = text.slice(SUC.length);
    return { ok: true, raw: text, payload, data: tryParseJson(payload) };
  }

  if (text.startsWith(ERR)) {
    const payload = text.slice(ERR.length);
    return {
      ok: false,
      raw: text,
      payload,
      error: payload.trim() || "Unbekannter Gateway-Fehler",
    };
  }

  if (text.startsWith("{")) {
    try {
      const obj = JSON.parse(text) as Record<string, unknown>;
      if ("XC_SUC" in obj) {
        return { ok: true, raw: text, payload: text, data: obj.XC_SUC };
      }
      if ("XC_ERR" in obj) {
        const err = obj.XC_ERR;
        return {
          ok: false,
          raw: text,
          payload: text,
          error: typeof err === "string" ? err : JSON.stringify(err),
        };
      }
    } catch {
      /* fall through */
    }
  }

  return {
    ok: false,
    raw: text,
    payload: text,
    error: "Unerwartete Gateway-Antwort (kein {XC_SUC}/{XC_ERR})",
  };
}

/** Hex mediola code: starts with 1908 or ends with 001908 (official docs). */
export function looksLikeMediolaCode(value: string): boolean {
  const hex = value.trim().toUpperCase();
  if (!/^[0-9A-F]+$/.test(hex) || hex.length < 8) return false;
  return hex.startsWith("1908") || hex.endsWith("001908");
}

/**
 * Pull a learned CODE out of a successful Learn response.
 * Tolerates FHEM-style bodies and V5 `{"CODE":"…"}`.
 */
export function extractLearnedCode(result: ParseResult): LearnedCode | null {
  if (!result.ok) return null;

  const fromData = codeFromUnknown(result.data);
  if (fromData) return fromData;

  const payload = result.payload.trim();
  if (looksLikeMediolaCode(payload)) {
    return { code: payload.toUpperCase(), medium: guessMedium(payload) };
  }

  return null;
}

function codeFromUnknown(data: unknown): LearnedCode | null {
  if (data == null) return null;

  if (typeof data === "string") {
    const s = data.trim();
    if (looksLikeMediolaCode(s)) {
      return { code: s.toUpperCase(), medium: guessMedium(s) };
    }
    return null;
  }

  if (typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const key of ["CODE", "code", "Code"]) {
      const v = obj[key];
      if (typeof v === "string" && looksLikeMediolaCode(v)) {
        return { code: v.toUpperCase(), medium: guessMedium(v) };
      }
    }
  }

  return null;
}

/**
 * Heuristic only — Eva may not label IR vs RF.
 * Short RF-ish bursts often stay under ~40 hex chars; classic IR dumps are longer.
 * Caller can override when assigning.
 */
export function guessMedium(code: string): "ir" | "rf" | "unknown" {
  const len = code.trim().length;
  if (len >= 80) return "ir";
  if (len > 0 && len < 40) return "rf";
  return "unknown";
}

function tryParseJson(payload: string): unknown {
  const trimmed = payload.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return trimmed;
  }
}

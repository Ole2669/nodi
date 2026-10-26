export type ParseOk = {
  ok: true;
  raw: string;
  payload: string;
  data: unknown;
};

export type ParseErr = {
  ok: false;
  raw: string;
  payload: string;
  error: string;
};

export type ParseResult = ParseOk | ParseErr;

/** IR diode / RF output ids used by Send2 (official docs + FHEM attrs). */
export type IrRfId = "00" | "01" | "02" | "04" | "08";

export type Direction = "up" | "down" | "stop";

export type LearnedCode = {
  code: string;
  /** Best-effort; gateway does not always label the medium. */
  medium: "ir" | "rf" | "unknown";
};

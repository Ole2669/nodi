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

export type IrRfId = "00" | "01" | "02" | "04" | "08";

export type Direction = "up" | "down" | "stop";

export type LearnedCode = {
  code: string;

  medium: "ir" | "rf" | "unknown";
};

import { extractLearnedCode, parseMediolaResponse } from "./parser.js";
import type { IrRfId, LearnedCode, ParseResult } from "./types.js";

export type MediolaClientOptions = {
  baseUrl: string;
  timeoutMs?: number;
  learnTimeoutMs?: number;
  username?: string;
  password?: string;

  fetchImpl?: typeof fetch;
};

export class MediolaOfflineError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "MediolaOfflineError";
  }
}

export class MediolaClient {
  readonly baseUrl: string;
  readonly timeoutMs: number;
  readonly learnTimeoutMs: number;
  private readonly username?: string;
  private readonly password?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: MediolaClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, "");
    this.timeoutMs = opts.timeoutMs ?? 4000;
    this.learnTimeoutMs = opts.learnTimeoutMs ?? 90_000;
    this.username = opts.username;
    this.password = opts.password;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async ping(): Promise<{ online: true; html: string } | { online: false; error: string }> {
    try {
      const html = await this.fetchText(`${this.baseUrl}/`, this.timeoutMs);
      return { online: true, html };
    } catch (e) {
      return { online: false, error: formatOffline(e) };
    }
  }

  async learn(): Promise<ParseResult & { learned: LearnedCode | null }> {
    const result = await this.command("Learn", {}, this.learnTimeoutMs);
    return { ...result, learned: extractLearnedCode(result) };
  }

  buildSend2Url(code: string, ir: IrRfId = "01", rf: IrRfId = "00"): string {
    const q = new URLSearchParams();
    q.set("code", code);
    q.set("XC_FNC", "Send2");
    q.set("ir", ir);
    q.set("rf", rf);
    this.appendAuth(q);
    return `${this.baseUrl}/command?${q.toString()}`;
  }

  async send2(
    code: string,
    ir: IrRfId = "01",
    rf: IrRfId = "00",
  ): Promise<ParseResult> {
    return this.fetchParsed(this.buildSend2Url(code, ir, rf), this.timeoutMs);
  }

  async command(
    fn: string,
    params: Record<string, string> = {},
    timeoutMs = this.timeoutMs,
  ): Promise<ParseResult> {
    return this.fetchParsed(this.buildCommandUrl(fn, params), timeoutMs);
  }

  buildCommandUrl(fn: string, params: Record<string, string> = {}): string {
    const q = new URLSearchParams({ XC_FNC: fn, ...params });
    this.appendAuth(q);
    return `${this.baseUrl}/command?${q.toString()}`;
  }

  private appendAuth(q: URLSearchParams): void {
    if (this.username) q.set("XC_USER", this.username);
    if (this.password) q.set("XC_PASS", this.password);
  }

  private async fetchParsed(url: string, timeoutMs: number): Promise<ParseResult> {
    try {
      const raw = await this.fetchText(url, timeoutMs);
      return parseMediolaResponse(raw);
    } catch (e) {
      throw new MediolaOfflineError(formatOffline(e), e);
    }
  }

  private async fetchText(url: string, timeoutMs: number): Promise<string> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await this.fetchImpl(url, { signal: ctrl.signal });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }
      return await res.text();
    } finally {
      clearTimeout(timer);
    }
  }
}

export function redactGatewayUrl(url: string): string {
  return url
    .replace(/([?&]XC_PASS=)[^&]*/gi, "$1***")
    .replace(/([?&]XC_USER=)[^&]*/gi, "$1***");
}

function formatOffline(e: unknown): string {
  if (e instanceof Error) {
    if (e.name === "AbortError") {
      return "Gateway timeout — reachable? Button pressed in time?";
    }
    return `Gateway offline or unreachable: ${e.message}`;
  }
  return "Gateway offline or unreachable";
}

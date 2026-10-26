import type { NodiConfig } from "./config.js";
import {
  MediolaClient,
  MediolaOfflineError,
  redactGatewayUrl,
} from "./mediola/client.js";
import type { Direction, IrRfId } from "./mediola/types.js";
import {
  assignCode,
  channelsForMedium,
  getCode,
  loadStore,
  saveStore,
  type StoredCode,
} from "./store.js";

export type FlowResult = {
  ok: boolean;
  message: string;
  learned?: StoredCode;
  sendUrl?: string;
};

export function createClient(cfg: NodiConfig, fetchImpl?: typeof fetch): MediolaClient {
  return new MediolaClient({
    baseUrl: cfg.gatewayUrl,
    timeoutMs: cfg.timeoutMs,
    learnTimeoutMs: cfg.learnTimeoutMs,
    username: cfg.username,
    password: cfg.password,
    fetchImpl,
  });
}

export async function pingGateway(cfg: NodiConfig): Promise<FlowResult> {
  const client = createClient(cfg);
  const res = await client.ping();
  if (!res.online) return { ok: false, message: res.error };
  return { ok: true, message: `Gateway reachable: ${cfg.gatewayUrl}` };
}

export async function learnAndAssign(
  cfg: NodiConfig,
  shutterId: string,
  direction: Direction,
  opts: { label?: string; ir?: IrRfId; rf?: IrRfId; fetchImpl?: typeof fetch } = {},
): Promise<FlowResult> {
  const client = createClient(cfg, opts.fetchImpl);
  let result;
  try {
    result = await client.learn();
  } catch (e) {
    const msg = e instanceof MediolaOfflineError ? e.message : String(e);
    return { ok: false, message: `Learn failed: ${msg}` };
  }

  if (!result.ok) {
    return { ok: false, message: `Gateway error: ${result.error}` };
  }
  if (!result.learned) {
    return {
      ok: false,
      message: `No valid code in response: ${result.raw.slice(0, 200)}`,
    };
  }

  const channels = channelsForMedium(result.learned.medium);
  const entry: StoredCode = {
    code: result.learned.code,
    ir: opts.ir ?? channels.ir,
    rf: opts.rf ?? channels.rf,
    medium: result.learned.medium,
    learnedAt: new Date().toISOString(),
  };

  const store = assignCode(
    loadStore(cfg.dataDir),
    shutterId,
    direction,
    entry,
    opts.label,
  );
  saveStore(cfg.dataDir, store);

  return {
    ok: true,
    message: `Code for "${shutterId}" ${direction} saved (${entry.medium}, ir=${entry.ir} rf=${entry.rf})`,
    learned: entry,
  };
}

export function prepareSend(
  cfg: NodiConfig,
  shutterId: string,
  direction: Direction,
): FlowResult {
  const stored = getCode(loadStore(cfg.dataDir), shutterId, direction);
  if (!stored) {
    return {
      ok: false,
      message: `No code for "${shutterId}" ${direction} — learn first`,
    };
  }
  const client = createClient(cfg);
  const sendUrl = client.buildSend2Url(stored.code, stored.ir, stored.rf);
  return {
    ok: true,
    message: `Send2 prepared (not sent yet)`,
    sendUrl: redactGatewayUrl(sendUrl),
    learned: stored,
  };
}

export async function sendConfirmed(
  cfg: NodiConfig,
  shutterId: string,
  direction: Direction,
  confirm: boolean,
  fetchImpl?: typeof fetch,
): Promise<FlowResult> {
  if (!confirm) {
    const prep = prepareSend(cfg, shutterId, direction);
    if (!prep.ok) return prep;
    return {
      ok: false,
      message: `Send aborted — confirmation missing (--yes). URL would be:\n${prep.sendUrl}`,
      sendUrl: prep.sendUrl,
      learned: prep.learned,
    };
  }

  const stored = getCode(loadStore(cfg.dataDir), shutterId, direction);
  if (!stored) {
    return {
      ok: false,
      message: `No code for "${shutterId}" ${direction} — learn first`,
    };
  }

  const client = createClient(cfg, fetchImpl);
  const sendUrl = redactGatewayUrl(
    client.buildSend2Url(stored.code, stored.ir, stored.rf),
  );
  try {
    const result = await client.send2(stored.code, stored.ir, stored.rf);
    if (!result.ok) {
      return {
        ok: false,
        message: `Send2 rejected: ${result.error}`,
        sendUrl,
        learned: stored,
      };
    }
    return {
      ok: true,
      message: `Send2 accepted (${shutterId} ${direction}) — verify physical movement yourself`,
      sendUrl,
      learned: stored,
    };
  } catch (e) {
    const msg = e instanceof MediolaOfflineError ? e.message : String(e);
    return { ok: false, message: `Send2 failed: ${msg}`, sendUrl, learned: stored };
  }
}

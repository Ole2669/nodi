import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MediolaClient,
  MediolaOfflineError,
  redactGatewayUrl,
} from "./client.js";

const SAMPLE =
  "19082601000200000100DE58800101010000000000000100000000";

function mockFetch(body: string, status = 200): typeof fetch {
  return (async (input) => {
    void input;
    return new Response(body, { status });
  }) as typeof fetch;
}

describe("MediolaClient", () => {
  it("builds Send2 URL with code before XC_FNC", () => {
    const c = new MediolaClient({ baseUrl: "http://gw.local" });
    const url = c.buildSend2Url(SAMPLE, "01", "00");
    assert.match(url, /^http:\/\/gw\.local\/command\?/);
    assert.ok(url.indexOf("code=") < url.indexOf("XC_FNC="));
    assert.match(url, /ir=01/);
    assert.match(url, /rf=00/);
  });

  it("learn extracts CODE from simulated response", async () => {
    const c = new MediolaClient({
      baseUrl: "http://gw.local",
      fetchImpl: mockFetch(`{XC_SUC}{"CODE":"${SAMPLE}"}`),
    });
    const res = await c.learn();
    assert.equal(res.ok, true);
    assert.equal(res.learned?.code, SAMPLE.toUpperCase());
  });

  it("send2 parses success", async () => {
    const c = new MediolaClient({
      baseUrl: "http://gw.local",
      fetchImpl: mockFetch("{XC_SUC}"),
    });
    const res = await c.send2(SAMPLE);
    assert.equal(res.ok, true);
  });

  it("maps abort to offline timeout", async () => {
    const c = new MediolaClient({
      baseUrl: "http://gw.local",
      timeoutMs: 20,
      fetchImpl: (async (_url, init) => {
        await new Promise<never>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const err = new Error("aborted");
            err.name = "AbortError";
            reject(err);
          });
        });
        return new Response("");
      }) as typeof fetch,
    });
    await assert.rejects(() => c.send2(SAMPLE), MediolaOfflineError);
  });

  it("ping reports offline on network error", async () => {
    const c = new MediolaClient({
      baseUrl: "http://gw.local",
      fetchImpl: (async () => {
        throw new Error("ECONNREFUSED");
      }) as typeof fetch,
    });
    const res = await c.ping();
    assert.equal(res.online, false);
  });

  it("redactGatewayUrl masks XC_USER and XC_PASS", () => {
    const url =
      "http://gw.local/command?code=ABC&XC_FNC=Send2&XC_USER=alice&XC_PASS=s3cret";
    assert.equal(
      redactGatewayUrl(url),
      "http://gw.local/command?code=ABC&XC_FNC=Send2&XC_USER=***&XC_PASS=***",
    );
  });
});

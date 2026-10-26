import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractLearnedCode,
  looksLikeMediolaCode,
  parseMediolaResponse,
} from "./parser.js";

const IR_CODE =
  "19082600000100260608B6044D00890089008901A20089277A08B6022D00895DA90001010201010101010202010202020202010101020101010102020201020202020304050405";
const RF_CODE = "19082601000200000100DE58800101010000000000000100000000";

describe("parseMediolaResponse", () => {
  it("parses classic XC_SUC with JSON payload", () => {
    const r = parseMediolaResponse(`{XC_SUC}{"CODE":"${IR_CODE}"}`);
    assert.equal(r.ok, true);
    if (r.ok) assert.deepEqual(r.data, { CODE: IR_CODE });
  });

  it("parses classic XC_ERR", () => {
    const r = parseMediolaResponse("{XC_ERR}busy");
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.error, "busy");
  });

  it("parses V5 JSON success", () => {
    const r = parseMediolaResponse(JSON.stringify({ XC_SUC: { CODE: RF_CODE } }));
    assert.equal(r.ok, true);
    if (r.ok) assert.deepEqual(r.data, { CODE: RF_CODE });
  });

  it("parses V5 JSON error", () => {
    const r = parseMediolaResponse(JSON.stringify({ XC_ERR: "timeout" }));
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.error, "timeout");
  });

  it("rejects empty and garbage", () => {
    assert.equal(parseMediolaResponse("").ok, false);
    assert.equal(parseMediolaResponse("<html>nope</html>").ok, false);
  });
});

describe("extractLearnedCode", () => {
  it("extracts CODE from classic Learn body", () => {
    const r = parseMediolaResponse(`{XC_SUC}{"CODE":"${IR_CODE}"}`);
    const learned = extractLearnedCode(r);
    assert.ok(learned);
    assert.equal(learned!.code, IR_CODE.toUpperCase());
    assert.equal(learned!.medium, "ir");
  });

  it("extracts bare hex payload", () => {
    const r = parseMediolaResponse(`{XC_SUC}${RF_CODE}`);
    const learned = extractLearnedCode(r);
    assert.ok(learned);
    assert.equal(learned!.code, RF_CODE.toUpperCase());
  });

  it("extracts V5 CODE object", () => {
    const r = parseMediolaResponse(JSON.stringify({ XC_SUC: { CODE: RF_CODE } }));
    const learned = extractLearnedCode(r);
    assert.ok(learned);
    assert.equal(learned!.code, RF_CODE.toUpperCase());
  });

  it("returns null on success without code", () => {
    const r = parseMediolaResponse("{XC_SUC}");
    assert.equal(extractLearnedCode(r), null);
  });

  it("returns null on error", () => {
    const r = parseMediolaResponse("{XC_ERR}nope");
    assert.equal(extractLearnedCode(r), null);
  });
});

describe("looksLikeMediolaCode", () => {
  it("accepts 1908… codes", () => {
    assert.equal(looksLikeMediolaCode(IR_CODE), true);
    assert.equal(looksLikeMediolaCode("DEADBEEF"), false);
    assert.equal(looksLikeMediolaCode("1908"), false);
  });
});

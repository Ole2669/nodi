from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import Any, TYPE_CHECKING
from urllib.parse import urlencode

if TYPE_CHECKING:
    from aiohttp import ClientSession

_LOGGER = logging.getLogger(__name__)

SUC = "{XC_SUC}"
ERR = "{XC_ERR}"

@dataclass
class LearnedCode:
    code: str
    medium: str

class MediolaError(Exception):
    pass

class MediolaClient:
    def __init__(
        self,
        session: "ClientSession",
        host: str,
        port: int = 80,
        username: str | None = None,
        password: str | None = None,
        timeout: float = 10,
        learn_timeout: float = 90,
    ) -> None:
        self._session = session
        self._base = f"http://{host}:{port}".rstrip("/")
        if port == 80:
            self._base = f"http://{host}"
        self._username = username or None
        self._password = password or None
        self._timeout = timeout
        self._learn_timeout = learn_timeout
        self.learn_timeout = learn_timeout

    async def ping(self) -> None:
        from aiohttp import ClientTimeout

        timeout = ClientTimeout(total=self._timeout)
        async with self._session.get(f"{self._base}/", timeout=timeout) as resp:
            resp.raise_for_status()
            await resp.text()

    async def learn(self) -> LearnedCode:
        text = await self._get({"XC_FNC": "Learn"}, timeout=self._learn_timeout)
        parsed = parse_response(text)
        if not parsed["ok"]:
            raise MediolaError(parsed["error"])
        learned = extract_learned_code(parsed)
        if not learned:
            raise MediolaError(f"No valid code in response: {text[:200]}")
        return learned

    async def send2(self, code: str, ir: str = "01", rf: str = "00") -> None:

        params: dict[str, str] = {
            "code": code,
            "XC_FNC": "Send2",
            "ir": ir,
            "rf": rf,
        }
        text = await self._get(params, timeout=self._timeout, ordered=True)
        parsed = parse_response(text)
        if not parsed["ok"]:
            raise MediolaError(parsed["error"])

    async def _get(
        self,
        params: dict[str, str],
        *,
        timeout: float,
        ordered: bool = False,
    ) -> str:
        from aiohttp import ClientError, ClientTimeout

        q = dict(params)
        if self._username:
            q["XC_USER"] = self._username
        if self._password:
            q["XC_PASS"] = self._password

        if ordered:

            query = urlencode(list(q.items()))
        else:
            query = urlencode(q)

        url = f"{self._base}/command?{query}"
        safe = url
        if self._password:
            safe = safe.replace(self._password, "***")
        if self._username:
            safe = safe.replace(self._username, "***")
        _LOGGER.debug("Mediola GET %s", safe)
        try:
            async with self._session.get(
                url, timeout=ClientTimeout(total=timeout)
            ) as resp:
                resp.raise_for_status()
                return await resp.text()
        except ClientError as err:
            raise MediolaError(f"Gateway unreachable: {err}") from err

def parse_response(raw: str) -> dict[str, Any]:
    text = raw.strip()
    if not text:
        return {"ok": False, "error": "Empty gateway response", "data": None, "payload": ""}

    if text.startswith(SUC):
        payload = text[len(SUC) :]
        return {"ok": True, "error": None, "data": _try_json(payload), "payload": payload}

    if text.startswith(ERR):
        payload = text[len(ERR) :]
        return {
            "ok": False,
            "error": payload.strip() or "Unknown gateway error",
            "data": None,
            "payload": payload,
        }

    if text.startswith("{"):
        try:
            obj = json.loads(text)
        except json.JSONDecodeError:
            obj = None
        if isinstance(obj, dict):
            if "XC_SUC" in obj:
                return {
                    "ok": True,
                    "error": None,
                    "data": obj["XC_SUC"],
                    "payload": text,
                }
            if "XC_ERR" in obj:
                err = obj["XC_ERR"]
                return {
                    "ok": False,
                    "error": err if isinstance(err, str) else json.dumps(err),
                    "data": None,
                    "payload": text,
                }

    return {
        "ok": False,
        "error": "Unexpected gateway response (no {XC_SUC}/{XC_ERR})",
        "data": None,
        "payload": text,
    }

def extract_learned_code(parsed: dict[str, Any]) -> LearnedCode | None:
    if not parsed.get("ok"):
        return None
    data = parsed.get("data")
    code = _code_from_unknown(data)
    if code:
        return LearnedCode(code=code, medium=_guess_medium(code))
    payload = (parsed.get("payload") or "").strip()
    if _looks_like_code(payload):
        return LearnedCode(code=payload.upper(), medium=_guess_medium(payload))
    return None

def channels_for_medium(medium: str) -> tuple[str, str]:
    if medium == "rf":
        return "00", "01"
    if medium == "ir":
        return "01", "00"
    return "01", "00"

def _code_from_unknown(data: Any) -> str | None:
    if isinstance(data, str) and _looks_like_code(data):
        return data.upper()
    if isinstance(data, dict):
        for key in ("CODE", "code", "Code"):
            val = data.get(key)
            if isinstance(val, str) and _looks_like_code(val):
                return val.upper()
    return None

def _looks_like_code(value: str) -> bool:
    hex_s = value.strip().upper()
    if len(hex_s) < 8 or any(c not in "0123456789ABCDEF" for c in hex_s):
        return False
    return hex_s.startswith("1908") or hex_s.endswith("001908")

def _guess_medium(code: str) -> str:
    length = len(code.strip())
    if length >= 80:
        return "ir"
    if 0 < length < 40:
        return "rf"
    return "unknown"

def _try_json(payload: str) -> Any:
    trimmed = payload.strip()
    if not trimmed:
        return None
    try:
        return json.loads(trimmed)
    except json.JSONDecodeError:
        return trimmed

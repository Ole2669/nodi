from __future__ import annotations

from copy import deepcopy
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import DIRECTIONS, STORAGE_KEY, STORAGE_VERSION

class CodesStore:
    def __init__(self, hass: HomeAssistant) -> None:
        self._store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self._data: dict[str, Any] = {"shutters": {}}

    async def async_load(self) -> None:
        data = await self._store.async_load()
        if data and isinstance(data.get("shutters"), dict):
            self._data = data
        else:
            self._data = {"shutters": {}}

    async def async_save(self) -> None:
        await self._store.async_save(self._data)

    @property
    def shutters(self) -> dict[str, Any]:
        return self._data.setdefault("shutters", {})

    def list_ready(self) -> list[dict[str, Any]]:
        ready = []
        for sid, shutter in self.shutters.items():
            codes = shutter.get("codes") or {}
            if "up" in codes and "down" in codes:
                ready.append(
                    {
                        "id": sid,
                        "label": shutter.get("label") or sid,
                        "codes": codes,
                        "inverted": bool(shutter.get("inverted", False)),
                        "travel_time": shutter.get("travel_time"),
                    }
                )
        return ready

    def get_code(self, shutter_id: str, direction: str) -> dict[str, Any] | None:
        shutter = self.shutters.get(shutter_id)
        if not shutter:
            return None
        return (shutter.get("codes") or {}).get(direction)

    async def async_assign(
        self,
        shutter_id: str,
        direction: str,
        *,
        code: str,
        ir: str,
        rf: str,
        medium: str,
        label: str | None = None,
        learned_at: str,
    ) -> None:
        if direction not in DIRECTIONS:
            raise ValueError(f"Invalid direction: {direction}")
        shutters = self.shutters
        existing = shutters.get(shutter_id) or {
            "id": shutter_id,
            "label": shutter_id,
            "codes": {},
        }
        existing = deepcopy(existing)
        if label and label.strip():
            existing["label"] = label.strip()
        existing["id"] = shutter_id
        existing.setdefault("codes", {})[direction] = {
            "code": code,
            "ir": ir,
            "rf": rf,
            "medium": medium,
            "learnedAt": learned_at,
        }
        shutters[shutter_id] = existing
        await self.async_save()

    async def async_set_options(
        self,
        shutter_id: str,
        *,
        inverted: bool | None = None,
        travel_time: float | None = None,
    ) -> str:
        if shutter_id not in self.shutters:
            raise ValueError(f"Unknown shutter: {shutter_id}")
        shutter = deepcopy(self.shutters[shutter_id])
        if inverted is not None:
            shutter["inverted"] = bool(inverted)
        if travel_time is not None:
            shutter["travel_time"] = float(travel_time)
        self.shutters[shutter_id] = shutter
        await self.async_save()
        return (
            f"{shutter_id}: inverted={shutter.get('inverted', False)}, "
            f"travel_time={shutter.get('travel_time', 'default')}"
        )

    async def async_remove(
        self, shutter_id: str, direction: str | None = None
    ) -> str | None:
        if shutter_id not in self.shutters:
            return None
        if direction is None:
            del self.shutters[shutter_id]
            await self.async_save()
            return f"shutter \"{shutter_id}\" fully removed"
        codes = self.shutters[shutter_id].get("codes") or {}
        if direction not in codes:
            return None
        del codes[direction]
        if not codes:
            del self.shutters[shutter_id]
            await self.async_save()
            return f"\"{shutter_id}\" {direction} (empty → removed)"
        await self.async_save()
        return f"\"{shutter_id}\" {direction}"

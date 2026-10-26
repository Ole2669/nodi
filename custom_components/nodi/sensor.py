from __future__ import annotations

from typing import Any

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN

async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    async_add_entities([NodiStatusSensor(hass, entry.entry_id)])

class NodiStatusSensor(SensorEntity):
    _attr_has_entity_name = True
    _attr_name = "Status"
    _attr_icon = "mdi:window-shutter"

    def __init__(self, hass: HomeAssistant, entry_id: str) -> None:
        self.hass = hass
        self._entry_id = entry_id
        self._attr_unique_id = f"nodi_{entry_id}_status"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, entry_id)},
            name="Nodi Mediola",
            manufacturer="Mediola",
            model="Eva a.i.o. Gateway",
        )

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(
            self.hass.bus.async_listen(f"{DOMAIN}_update", self._handle_update)
        )

    @callback
    def _handle_update(self, _event: Any) -> None:
        self.async_write_ha_state()

    @property
    def native_value(self) -> str:
        store = self._store
        if not store:
            return "not loaded"
        total = len(store.shutters)
        ready = len(store.list_ready())
        if total == 0:
            return "no codes"
        return f"{ready}/{total} ready"

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        store = self._store
        data = (self.hass.data.get(DOMAIN) or {}).get(self._entry_id) or {}
        last = data.get("last_event")
        shutters: list[dict[str, Any]] = []
        if store:
            for sid, shutter in sorted(store.shutters.items()):
                codes = shutter.get("codes") or {}
                shutters.append(
                    {
                        "id": sid,
                        "label": shutter.get("label") or sid,
                        "ready": "up" in codes and "down" in codes,
                        "directions": list(codes.keys()),
                        "codes_preview": {
                            d: (c.get("code") or "")[:24]
                            for d, c in codes.items()
                        },
                    }
                )
        return {
            "shutters": shutters,
            "last_event": last,
        }

    @property
    def _store(self) -> Any:
        data = (self.hass.data.get(DOMAIN) or {}).get(self._entry_id)
        return data["store"] if data else None

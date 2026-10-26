from __future__ import annotations

import logging
from typing import Any

from homeassistant.components.cover import (
    CoverDeviceClass,
    CoverEntity,
    CoverEntityFeature,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.event import async_call_later

from .const import DOMAIN
from .mediola import MediolaError

_LOGGER = logging.getLogger(__name__)

Status = str

async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    data = hass.data[DOMAIN][entry.entry_id]
    store = data["store"]
    client = data["client"]
    travel = float(entry.data.get("travel_time", 25))

    entities = [
        NodiCover(hass, client, store, entry.entry_id, shutter, travel)
        for shutter in store.list_ready()
    ]
    async_add_entities(entities)

class NodiCover(CoverEntity):
    _attr_device_class = CoverDeviceClass.SHUTTER
    _attr_assumed_state = True

    _attr_has_entity_name = True
    _attr_name = None
    _attr_supported_features = CoverEntityFeature.OPEN | CoverEntityFeature.CLOSE

    _STATUS_LABEL = {
        "open": "Open",
        "closed": "Closed",
        "stopped": "Stopped",
        "opening": "Opening…",
        "closing": "Closing…",
    }

    def __init__(
        self,
        hass: HomeAssistant,
        client: Any,
        store: Any,
        entry_id: str,
        shutter: dict,
        travel_time: float,
    ) -> None:
        self.hass = hass
        self._client = client
        self._store = store
        self._shutter_id = shutter["id"]
        self._inverted = bool(shutter.get("inverted", False))
        self._travel_time = float(shutter.get("travel_time") or travel_time)
        self._base_name = shutter["label"]
        self._attr_unique_id = f"nodi_{entry_id}_{shutter['id']}"
        self._status: Status = "stopped"
        self._unsub_timer = None

        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, f"{entry_id}_{self._shutter_id}")},
            name=self._base_name,
            manufacturer="Mediola",
            model="Eva a.i.o. Gateway",
            via_device=(DOMAIN, entry_id),
        )

    @property
    def is_closed(self) -> bool:

        return self._status == "closed"

    @property
    def is_opening(self) -> bool:
        return False

    @property
    def is_closing(self) -> bool:
        return False

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        return {
            "status_text": self._STATUS_LABEL.get(self._status, self._status),
            "friendly_label": self._base_name,
            "nodi_status": self._status,
            "inverted": self._inverted,
            "travel_time": self._travel_time,
        }

    async def async_open_cover(self, **kwargs: Any) -> None:
        if self._status == "closing":
            await self._stop_by_reverse("open")
            return
        if self._status == "opening":
            await self._send_logical("open")
            return

        await self._send_logical("open")
        self._status = "opening"
        self.async_write_ha_state()
        self._arm_timer("open")

    async def async_close_cover(self, **kwargs: Any) -> None:
        if self._status == "opening":
            await self._stop_by_reverse("close")
            return
        if self._status == "closing":
            await self._send_logical("close")
            return

        await self._send_logical("close")
        self._status = "closing"
        self.async_write_ha_state()
        self._arm_timer("closed")

    async def _stop_by_reverse(self, logical_action: str) -> None:
        await self._send_logical(logical_action)
        self._cancel_timer()
        self._status = "stopped"
        self.async_write_ha_state()

    def _arm_timer(self, final_status: Status) -> None:
        self._cancel_timer()

        @callback
        def _finished(_now: Any) -> None:
            self._unsub_timer = None
            self._status = final_status
            self.async_write_ha_state()

        self._unsub_timer = async_call_later(self.hass, self._travel_time, _finished)

    def _cancel_timer(self) -> None:
        if self._unsub_timer is not None:
            self._unsub_timer()
            self._unsub_timer = None

    async def _send_logical(self, action: str) -> None:
        if action == "open":
            direction = "down" if self._inverted else "up"
        else:
            direction = "up" if self._inverted else "down"
        await self._send(direction)

    async def _send(self, direction: str) -> None:
        entry = self._store.get_code(self._shutter_id, direction)
        if not entry:
            raise HomeAssistantError(
                f"No code for {self._shutter_id} {direction} — learn first"
            )
        try:
            await self._client.send2(
                entry["code"], entry.get("ir", "01"), entry.get("rf", "00")
            )
        except MediolaError as err:
            raise HomeAssistantError(str(err)) from err

    async def async_will_remove_from_hass(self) -> None:
        self._cancel_timer()

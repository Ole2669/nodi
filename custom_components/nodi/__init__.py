from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

import voluptuous as vol
from homeassistant.components.persistent_notification import (
    async_create as async_create_notification,
    async_dismiss as async_dismiss_notification,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import CONF_HOST, CONF_PASSWORD, CONF_PORT, CONF_USERNAME, Platform
from homeassistant.core import HomeAssistant, ServiceCall, callback
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .codes import CodesStore
from .const import DEFAULT_LEARN_TIMEOUT, DEFAULT_PORT, DIRECTIONS, DOMAIN

try:
    from homeassistant.core import SupportsResponse

    _SUPPORTS_RESPONSE = True
except ImportError:
    SupportsResponse = None
    _SUPPORTS_RESPONSE = False
from .mediola import MediolaClient, MediolaError, channels_for_medium

_LOGGER = logging.getLogger(__name__)

PLATFORMS = [Platform.COVER, Platform.SENSOR]

SERVICE_LEARN = "learn"
SERVICE_REMOVE = "remove"
SERVICE_LIST = "list_codes"
SERVICE_SET_OPTIONS = "set_options"

LEARN_SCHEMA = vol.Schema(
    {
        vol.Required("shutter_id"): cv.string,
        vol.Required("direction"): vol.In(DIRECTIONS),
        vol.Optional("name"): cv.string,
        vol.Optional("ir"): cv.string,
        vol.Optional("rf"): cv.string,
    }
)

REMOVE_SCHEMA = vol.Schema(
    {
        vol.Required("shutter_id"): cv.string,
        vol.Optional("direction"): vol.In(DIRECTIONS),
    }
)

OPTIONS_SCHEMA = vol.Schema(
    {
        vol.Required("shutter_id"): cv.string,
        vol.Optional("inverted"): cv.boolean,
        vol.Optional("travel_time"): vol.All(vol.Coerce(float), vol.Range(min=5, max=120)),
    }
)

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    session = async_get_clientsession(hass)
    data = entry.data
    client = MediolaClient(
        session,
        host=data[CONF_HOST],
        port=int(data.get(CONF_PORT, DEFAULT_PORT)),
        username=data.get(CONF_USERNAME) or None,
        password=data.get(CONF_PASSWORD) or None,
        learn_timeout=float(data.get("learn_timeout", DEFAULT_LEARN_TIMEOUT)),
    )

    store = CodesStore(hass)
    await store.async_load()

    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN][entry.entry_id] = {
        "client": client,
        "store": store,
        "last_event": None,
    }

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    _async_register_services(hass)
    return True

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok:
        hass.data[DOMAIN].pop(entry.entry_id, None)
        if not hass.data[DOMAIN]:
            for svc in (
                SERVICE_LEARN,
                SERVICE_REMOVE,
                SERVICE_LIST,
                SERVICE_SET_OPTIONS,
            ):
                hass.services.async_remove(DOMAIN, svc)
            hass.data.pop(DOMAIN, None)
    return unload_ok

def _async_register_services(hass: HomeAssistant) -> None:
    if hass.services.has_service(DOMAIN, SERVICE_LEARN):
        return

    def _wants_response(call: ServiceCall) -> bool:
        return bool(getattr(call, "return_response", False))

    def _register(name: str, handler: Any, schema: Any = None, response: Any = None) -> None:
        kwargs: dict[str, Any] = {}
        if schema is not None:
            kwargs["schema"] = schema
        if _SUPPORTS_RESPONSE and response is not None:
            kwargs["supports_response"] = response
        hass.services.async_register(DOMAIN, name, handler, **kwargs)

    async def handle_learn(call: ServiceCall) -> dict[str, Any] | None:
        entry_id, data = _first_entry(hass)
        client: MediolaClient = data["client"]
        store: CodesStore = data["store"]

        shutter_id = call.data["shutter_id"].strip()
        direction = call.data["direction"]
        name = call.data.get("name")
        dir_label = {"up": "up", "down": "down", "stop": "stop"}.get(
            direction, direction
        )

        async_create_notification(
            hass,
            (
                f"**Learn mode active** for `{shutter_id}` → {dir_label}.\n\n"
                f"Press the remote near the Mediola gateway "
                f"(timeout ~{int(client.learn_timeout)} s)."
            ),
            title="Nodi — Learn",
            notification_id="nodi_learn",
        )

        try:
            learned = await client.learn()
        except MediolaError as err:
            msg = f"Learn failed: {err}"
            async_create_notification(
                hass, msg, title="Nodi — Error", notification_id="nodi_learn"
            )
            _set_last_event(data, "learn_error", msg)
            _async_update_sensors(hass)
            raise HomeAssistantError(msg) from err

        ir_default, rf_default = channels_for_medium(learned.medium)
        ir = call.data.get("ir") or ir_default
        rf = call.data.get("rf") or rf_default
        await store.async_assign(
            shutter_id,
            direction,
            code=learned.code,
            ir=ir,
            rf=rf,
            medium=learned.medium,
            label=name,
            learned_at=datetime.now(timezone.utc).isoformat(),
        )

        shutter = store.shutters.get(shutter_id) or {}
        codes = shutter.get("codes") or {}
        ready = "up" in codes and "down" in codes
        missing = [d for d in ("up", "down") if d not in codes]

        success_msg = (
            f"**Saved:** `{shutter_id}` / {dir_label}\n\n"
            f"Code: `{learned.code[:40]}…` ({len(learned.code)} chars)\n"
            f"Channel: ir={ir} rf={rf} medium={learned.medium}\n\n"
        )
        if ready:
            success_msg += "Cover is ready (up+down present). Reloading entities."
        else:
            success_msg += (
                f"Still missing: {', '.join(missing)}. "
                f"Run `nodi.learn` again with direction=`{missing[0]}`."
            )

        async_create_notification(
            hass,
            success_msg,
            title="Nodi — Learn OK",
            notification_id="nodi_learn",
        )
        _set_last_event(
            data,
            "learn_ok",
            {
                "shutter_id": shutter_id,
                "direction": direction,
                "code": learned.code,
                "ready": ready,
            },
        )
        _async_update_sensors(hass)

        hass.async_create_task(hass.config_entries.async_reload(entry_id))

        result = {
            "ok": True,
            "message": success_msg.replace("**", "").replace("`", ""),
            "shutter_id": shutter_id,
            "direction": direction,
            "code": learned.code,
            "ir": ir,
            "rf": rf,
            "medium": learned.medium,
            "ready": ready,
            "missing": missing,
        }
        if _wants_response(call):
            return result
        return None

    async def handle_remove(call: ServiceCall) -> dict[str, Any] | None:
        entry_id, data = _first_entry(hass)
        store: CodesStore = data["store"]
        shutter_id = call.data["shutter_id"].strip()
        direction = call.data.get("direction")
        removed = await store.async_remove(shutter_id, direction)
        if not removed:
            msg = "Nothing to remove (unknown ID/direction)."
            async_create_notification(
                hass, msg, title="Nodi — Remove", notification_id="nodi_remove"
            )
            raise HomeAssistantError(msg)

        async_create_notification(
            hass,
            f"Removed: {removed}",
            title="Nodi — Remove OK",
            notification_id="nodi_remove",
        )
        _set_last_event(data, "remove_ok", removed)
        _async_update_sensors(hass)
        hass.async_create_task(hass.config_entries.async_reload(entry_id))

        result = {"ok": True, "removed": removed}
        if _wants_response(call):
            return result
        return None

    async def handle_list(call: ServiceCall) -> dict[str, Any]:
        _, data = _first_entry(hass)
        store: CodesStore = data["store"]
        shutters_out: list[dict[str, Any]] = []
        lines: list[str] = []

        for sid, shutter in sorted(store.shutters.items()):
            codes = shutter.get("codes") or {}
            ready = "up" in codes and "down" in codes
            dirs: dict[str, Any] = {}
            for direction, entry in codes.items():
                dirs[direction] = {
                    "code": entry.get("code"),
                    "code_preview": (entry.get("code") or "")[:32],
                    "ir": entry.get("ir"),
                    "rf": entry.get("rf"),
                    "medium": entry.get("medium"),
                    "learned_at": entry.get("learnedAt"),
                }
            item = {
                "id": sid,
                "label": shutter.get("label") or sid,
                "ready": ready,
                "directions": list(codes.keys()),
                "codes": dirs,
            }
            shutters_out.append(item)
            lines.append(
                f"**{sid}** ({item['label']}) — "
                f"{'cover ready' if ready else 'incomplete'}: "
                f"{', '.join(codes.keys()) or 'no codes'}"
            )
            for direction, meta in dirs.items():
                lines.append(
                    f"  · {direction}: `{meta['code_preview']}…` "
                    f"({len(meta['code'] or '')} chars)"
                )

        if not shutters_out:
            message = (
                "No learned commands stored.\n\n"
                "Run action `nodi.learn` first (up and down)."
            )
        else:
            message = "\n".join(lines)

        async_dismiss_notification(hass, "nodi_list_codes")
        async_create_notification(
            hass,
            message,
            title=f"Nodi — {len(shutters_out)} shutter(s)",
            notification_id="nodi_list_codes",
        )
        _LOGGER.debug("Nodi list_codes: %s shutter(s)", len(shutters_out))

        return {
            "count": len(shutters_out),
            "ready_count": sum(1 for s in shutters_out if s["ready"]),
            "shutters": shutters_out,
            "message": message.replace("**", "").replace("`", "").replace("·", "-"),
        }

    async def handle_set_options(call: ServiceCall) -> dict[str, Any] | None:
        entry_id, data = _first_entry(hass)
        store: CodesStore = data["store"]
        shutter_id = call.data["shutter_id"].strip()
        try:
            msg = await store.async_set_options(
                shutter_id,
                inverted=call.data.get("inverted"),
                travel_time=call.data.get("travel_time"),
            )
        except ValueError as err:
            raise HomeAssistantError(str(err)) from err

        async_create_notification(
            hass,
            (
                f"**Options saved**\n\n{msg}\n\n"
                "inverted=true: shutter opens upward from the bottom."
            ),
            title="Nodi — Options",
            notification_id="nodi_options",
        )
        hass.async_create_task(hass.config_entries.async_reload(entry_id))
        if _wants_response(call):
            return {"ok": True, "message": msg}
        return None

    _register(
        SERVICE_LEARN,
        handle_learn,
        LEARN_SCHEMA,
        SupportsResponse.OPTIONAL if _SUPPORTS_RESPONSE else None,
    )
    _register(
        SERVICE_REMOVE,
        handle_remove,
        REMOVE_SCHEMA,
        SupportsResponse.OPTIONAL if _SUPPORTS_RESPONSE else None,
    )
    _register(
        SERVICE_LIST,
        handle_list,
        None,
        SupportsResponse.ONLY if _SUPPORTS_RESPONSE else None,
    )
    _register(
        SERVICE_SET_OPTIONS,
        handle_set_options,
        OPTIONS_SCHEMA,
        SupportsResponse.OPTIONAL if _SUPPORTS_RESPONSE else None,
    )

def _first_entry(hass: HomeAssistant) -> tuple[str, dict]:
    entries = hass.data.get(DOMAIN) or {}
    if not entries:
        raise HomeAssistantError("Nodi is not set up")
    entry_id = next(iter(entries))
    return entry_id, entries[entry_id]

def _set_last_event(data: dict, kind: str, detail: Any) -> None:
    data["last_event"] = {
        "kind": kind,
        "detail": detail,
        "at": datetime.now(timezone.utc).isoformat(),
    }

@callback
def _async_update_sensors(hass: HomeAssistant) -> None:
    hass.bus.async_fire(f"{DOMAIN}_update")

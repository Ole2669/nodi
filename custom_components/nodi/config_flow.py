from __future__ import annotations

from typing import Any

import voluptuous as vol
from homeassistant.config_entries import ConfigFlow
from homeassistant.const import CONF_HOST, CONF_PASSWORD, CONF_PORT, CONF_USERNAME
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .const import DEFAULT_LEARN_TIMEOUT, DEFAULT_PORT, DEFAULT_TRAVEL_TIME, DOMAIN
from .mediola import MediolaClient, MediolaError

try:
    from homeassistant.config_entries import ConfigFlowResult
except ImportError:
    from homeassistant.data_entry_flow import FlowResult as ConfigFlowResult

STEP_USER = vol.Schema(
    {
        vol.Required(CONF_HOST): str,
        vol.Optional(CONF_PORT, default=DEFAULT_PORT): int,
        vol.Optional(CONF_USERNAME): str,
        vol.Optional(CONF_PASSWORD): str,
        vol.Optional("learn_timeout", default=DEFAULT_LEARN_TIMEOUT): int,
        vol.Optional("travel_time", default=DEFAULT_TRAVEL_TIME): int,
    }
)

class NodiConfigFlow(ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        errors: dict[str, str] = {}

        if user_input is not None:
            host = user_input[CONF_HOST].strip()
            port = int(user_input.get(CONF_PORT, DEFAULT_PORT))
            await self.async_set_unique_id(f"nodi-{host.lower()}:{port}")
            self._abort_if_unique_id_configured()

            client = MediolaClient(
                async_get_clientsession(self.hass),
                host=host,
                port=port,
                username=user_input.get(CONF_USERNAME) or None,
                password=user_input.get(CONF_PASSWORD) or None,
                learn_timeout=float(
                    user_input.get("learn_timeout", DEFAULT_LEARN_TIMEOUT)
                ),
            )
            try:
                await client.ping()
            except (MediolaError, OSError, TimeoutError):
                errors["base"] = "cannot_connect"
            else:
                return self.async_create_entry(
                    title=f"Mediola ({host})",
                    data={
                        CONF_HOST: host,
                        CONF_PORT: port,
                        CONF_USERNAME: user_input.get(CONF_USERNAME) or "",
                        CONF_PASSWORD: user_input.get(CONF_PASSWORD) or "",
                        "learn_timeout": int(
                            user_input.get("learn_timeout", DEFAULT_LEARN_TIMEOUT)
                        ),
                        "travel_time": int(
                            user_input.get("travel_time", DEFAULT_TRAVEL_TIME)
                        ),
                    },
                )

        return self.async_show_form(
            step_id="user",
            data_schema=STEP_USER,
            errors=errors,
        )

from __future__ import annotations

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.data_entry_flow import FlowResult

from .const import DOMAIN


class TVDashboardConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Config flow for TV Dashboard."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict | None = None
    ) -> FlowResult:
        """Create the single TV Dashboard entry."""
        await self.async_set_unique_id(DOMAIN)
        self._abort_if_unique_id_configured()

        if user_input is not None:
            return self.async_create_entry(title="TV Dashboard", data={})

        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema({}),
        )

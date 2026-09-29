from __future__ import annotations

import logging

from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import (
    DOMAIN,
    FRONTEND_DIR,
    FRONTEND_FILE,
    FRONTEND_URL,
    PANEL_ELEMENT,
    PANEL_ICON,
    PANEL_TITLE,
    PANEL_URL,
    VERSION,
)

_LOGGER = logging.getLogger(__name__)


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Set up TV Dashboard."""
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up TV Dashboard from a config entry."""
    try:
        await hass.http.async_register_static_paths(
            [
                StaticPathConfig(
                    FRONTEND_URL,
                    str(FRONTEND_DIR),
                    cache_headers=False,
                )
            ]
        )
    except RuntimeError:
        pass

    frontend.async_remove_panel(hass, PANEL_URL, warn_if_unknown=False)

    await panel_custom.async_register_panel(
        hass=hass,
        frontend_url_path=PANEL_URL,
        webcomponent_name=PANEL_ELEMENT,
        sidebar_title=PANEL_TITLE,
        sidebar_icon=PANEL_ICON,
        module_url=f"{FRONTEND_URL}/{FRONTEND_FILE}?v={VERSION}",
        embed_iframe=False,
        require_admin=False,
        handle_safe_area=True,
        config={
            "version": VERSION,
            "source_dashboard": "/new-minimalist",
        },
    )

    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = True
    _LOGGER.info("TV Dashboard %s registered at /%s", VERSION, PANEL_URL)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload TV Dashboard."""
    frontend.async_remove_panel(hass, PANEL_URL, warn_if_unknown=False)
    hass.data.get(DOMAIN, {}).pop(entry.entry_id, None)
    return True

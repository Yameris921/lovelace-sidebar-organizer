"""WebSocket API for Lovelace Sidebar Organizer."""
from __future__ import annotations

import logging
import voluptuous as vol

from homeassistant.core import HomeAssistant
from homeassistant.components import websocket_api
from homeassistant.components.websocket_api import ActiveConnection

_LOGGER = logging.getLogger(__name__)
DOMAIN = "sidebar_organizer"


def async_register_commands(hass: HomeAssistant) -> None:
    """Register WebSocket commands."""
    websocket_api.async_register_command(hass, handle_get_config)
    websocket_api.async_register_command(hass, handle_save_config)


# ─── GET CONFIG ────────────────────────────────────────────────────────────────

@websocket_api.websocket_command({
    vol.Required("type"): "sidebar_organizer/get_config",
})
@websocket_api.async_response
async def handle_get_config(
    hass: HomeAssistant,
    connection: ActiveConnection,
    msg: dict,
) -> None:
    """Return the stored config. Accessible to all authenticated users."""
    data = hass.data.get(DOMAIN, {})
    config = data.get("config", {})
    connection.send_result(msg["id"], config)


# ─── SAVE CONFIG ───────────────────────────────────────────────────────────────

@websocket_api.websocket_command({
    vol.Required("type"): "sidebar_organizer/save_config",
    vol.Required("config"): dict,
})
@websocket_api.async_response
async def handle_save_config(
    hass: HomeAssistant,
    connection: ActiveConnection,
    msg: dict,
) -> None:
    """Save config to persistent storage. Admin only."""
    if not connection.user.is_admin:
        connection.send_error(
            msg["id"], "unauthorized",
            "Seuls les administrateurs peuvent modifier la configuration."
        )
        _LOGGER.warning(
            "Sidebar Organizer: tentative de modification non autorisée par %s",
            connection.user.name,
        )
        return

    config = msg["config"]

    # Basic validation
    if not isinstance(config.get("groups", []), list):
        connection.send_error(msg["id"], "invalid_format", "Format de config invalide.")
        return

    data = hass.data.get(DOMAIN, {})
    data["config"] = config

    store = data.get("store")
    if store:
        await store.async_save(config)

    _LOGGER.info(
        "Sidebar Organizer: config sauvegardée par %s (%d groupes)",
        connection.user.name,
        len(config.get("groups", [])),
    )
    connection.send_result(msg["id"], {"success": True})

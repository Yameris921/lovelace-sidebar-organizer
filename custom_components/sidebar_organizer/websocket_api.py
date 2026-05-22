"""WebSocket API for Lovelace Sidebar Organizer."""
from __future__ import annotations

import logging
import voluptuous as vol

from homeassistant.core import HomeAssistant
from homeassistant.components.websocket_api import (
    ActiveConnection,
    async_register_command,
    websocket_command,
    async_response,
    error_message,
    result_message,
)

_LOGGER = logging.getLogger(__name__)
DOMAIN = "sidebar_organizer"


def async_register_commands(hass: HomeAssistant) -> None:
    """Register WebSocket commands."""
    try:
        async_register_command(hass, handle_get_config)
        async_register_command(hass, handle_save_config)
        _LOGGER.info("Sidebar Organizer: WebSocket API enregistrée (%s, %s)", WS_GET, WS_SAVE)
    except Exception as exc:  # noqa: BLE001
        _LOGGER.error("Sidebar Organizer: échec enregistrement WebSocket — %s", exc)


WS_GET  = "sidebar_organizer/get_config"
WS_SAVE = "sidebar_organizer/save_config"


@websocket_command({
    vol.Required("type"): WS_GET,
})
@async_response
async def handle_get_config(
    hass: HomeAssistant,
    connection: ActiveConnection,
    msg: dict,
) -> None:
    """Return the stored config. All authenticated users."""
    try:
        data   = hass.data.get(DOMAIN, {})
        config = data.get("config", {})
        _LOGGER.debug("Sidebar Organizer: get_config pour %s", connection.user.name)
        connection.send_message(result_message(msg["id"], config))
    except Exception as exc:  # noqa: BLE001
        _LOGGER.error("Sidebar Organizer: erreur get_config — %s", exc)
        connection.send_message(error_message(msg["id"], "server_error", str(exc)))


@websocket_command({
    vol.Required("type"): WS_SAVE,
    vol.Required("config"): dict,
})
@async_response
async def handle_save_config(
    hass: HomeAssistant,
    connection: ActiveConnection,
    msg: dict,
) -> None:
    """Save config — admin only."""
    if not connection.user.is_admin:
        _LOGGER.warning(
            "Sidebar Organizer: tentative non autorisée par %s", connection.user.name
        )
        connection.send_message(
            error_message(msg["id"], "unauthorized",
                          "Seuls les administrateurs peuvent modifier la configuration.")
        )
        return

    try:
        config = msg["config"]
        if not isinstance(config.get("groups", []), list):
            connection.send_message(
                error_message(msg["id"], "invalid_format", "Format invalide.")
            )
            return

        data = hass.data.get(DOMAIN, {})
        data["config"] = config

        store = data.get("store")
        if store:
            await store.async_save(config)

        _LOGGER.info(
            "Sidebar Organizer: config sauvegardée par %s (%d groupes)",
            connection.user.name, len(config.get("groups", []))
        )
        connection.send_message(result_message(msg["id"], {"success": True}))

    except Exception as exc:  # noqa: BLE001
        _LOGGER.error("Sidebar Organizer: erreur save_config — %s", exc)
        connection.send_message(error_message(msg["id"], "server_error", str(exc)))

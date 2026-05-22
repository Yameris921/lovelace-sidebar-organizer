"""Lovelace Sidebar Organizer — Custom Component.

Provides:
  - Persistent server-side config storage (.storage/sidebar_organizer)
  - WebSocket API (sidebar_organizer/get_config, sidebar_organizer/save_config)
  - Auto-registration of the frontend JS module (no Lovelace resource needed)
  - Auto-registration of the config panel (no configuration.yaml needed)

Activated via: Settings → Devices & Services → Add Integration → Sidebar Organizer
"""
from __future__ import annotations

import logging
from pathlib import Path

from homeassistant.core import HomeAssistant
from homeassistant.config_entries import ConfigEntry
from homeassistant.helpers.storage import Store

from . import websocket_api as ws_api

_LOGGER = logging.getLogger(__name__)

DOMAIN          = "sidebar_organizer"
STORAGE_KEY     = "sidebar_organizer"
STORAGE_VERSION = 1

DEFAULT_CONFIG: dict = {
    "version"       : 1,
    "groups"        : [],
    "visitor_users" : [],
    "hidden_items"  : [],
}


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Called by HA on startup — only initialises hass.data."""
    hass.data.setdefault(DOMAIN, {})
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Sidebar Organizer from a config entry (UI flow)."""

    # ── 1. Persistent storage ──────────────────────────────────────────────
    store = Store(hass, STORAGE_VERSION, STORAGE_KEY)
    stored = await store.async_load()
    if stored is None:
        stored = dict(DEFAULT_CONFIG)
        await store.async_save(stored)

    hass.data[DOMAIN] = {
        "store"  : store,
        "config" : stored,
        "entry"  : entry,
    }

    # ── 2. Serve frontend JS as a static path ──────────────────────────────
    frontend_dir = Path(__file__).parent / "frontend"
    try:
        # HA 2023.9+ — méthode async avec StaticPathConfig
        from homeassistant.components.http import StaticPathConfig
        await hass.http.async_register_static_paths([
            StaticPathConfig(
                url_path     = "/sidebar_organizer",
                path         = str(frontend_dir),
                cache_headers= False,
            )
        ])
    except (ImportError, AttributeError):
        # Fallback anciennes versions
        hass.http.register_static_path(
            "/sidebar_organizer",
            str(frontend_dir),
            cache_headers=False,
        )

    # ── 3. Auto-load JS for all users ──────────────────────────────────────
    try:
        from homeassistant.components.frontend import add_extra_js_url
        add_extra_js_url(
            hass,
            "/sidebar_organizer/lovelace-sidebar-organizer.js",
            es5=False,
        )
        _LOGGER.debug("Sidebar Organizer: JS module auto-chargé")
    except Exception as exc:  # noqa: BLE001
        _LOGGER.warning(
            "Sidebar Organizer: impossible d'auto-charger le JS (%s). "
            "Ajoutez manuellement /sidebar_organizer/lovelace-sidebar-organizer.js "
            "comme ressource Lovelace.",
            exc,
        )

    # ── 4. Register config panel (admin only) ─────────────────────────────
    try:
        from homeassistant.components.panel_custom import async_register_panel
        await async_register_panel(
            hass,
            webcomponent_name = "lovelace-sidebar-organizer",
            frontend_url_path = "sidebar-organizer",
            sidebar_title     = "Sidebar Organizer",
            sidebar_icon      = "mdi:layers-edit",
            require_admin     = True,
            module_url        = "/sidebar_organizer/lovelace-sidebar-organizer.js",
            config            = {},
        )
        _LOGGER.debug("Sidebar Organizer: panel enregistré")
    except Exception as exc:  # noqa: BLE001
        _LOGGER.warning(
            "Sidebar Organizer: impossible d'enregistrer le panel (%s). "
            "Ajoutez manuellement panel_custom dans configuration.yaml.",
            exc,
        )

    # ── 5. WebSocket API ───────────────────────────────────────────────────
    ws_api.async_register_commands(hass)

    _LOGGER.info("Lovelace Sidebar Organizer v1.0.1 démarré")
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload the config entry."""
    hass.data.pop(DOMAIN, None)
    return True

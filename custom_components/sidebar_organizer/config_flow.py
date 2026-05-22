"""Config flow for Lovelace Sidebar Organizer.

Single-step flow — no user input required.
The user simply clicks Add → Submit and the integration is active.
"""
from __future__ import annotations

from homeassistant import config_entries
from homeassistant.core import callback

DOMAIN = "sidebar_organizer"


class SidebarOrganizerConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle the config flow — one click, no form."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict | None = None
    ) -> config_entries.FlowResult:
        """Single step: create the entry immediately."""
        # Prevent duplicate installations
        await self.async_set_unique_id(DOMAIN)
        self._abort_if_unique_id_configured()

        if user_input is not None:
            return self.async_create_entry(
                title="Sidebar Organizer",
                data={},
            )

        # Show a minimal confirmation form (no fields)
        return self.async_show_form(step_id="user")

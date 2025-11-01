"""Simple JSON-based settings storage for API keys."""
import json
from pathlib import Path
from typing import Optional

# Settings file location: in the backend/app directory
SETTINGS_FILE = Path(__file__).parent / "settings.json"


def get_setting(key: str) -> Optional[str]:
    """Get a setting value by key from JSON file."""
    if not SETTINGS_FILE.exists():
        return None
    
    try:
        with open(SETTINGS_FILE, "r") as f:
            settings = json.load(f)
            return settings.get(key)
    except (json.JSONDecodeError, IOError):
        return None


def set_setting(key: str, value: str) -> None:
    """Save or update a setting in JSON file."""
    # Load existing settings
    settings = {}
    if SETTINGS_FILE.exists():
        try:
            with open(SETTINGS_FILE, "r") as f:
                settings = json.load(f)
        except (json.JSONDecodeError, IOError):
            settings = {}
    
    # Update setting
    settings[key] = value
    
    # Write back to file
    with open(SETTINGS_FILE, "w") as f:
        json.dump(settings, f, indent=2)


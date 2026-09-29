# TV Dashboard for Home Assistant

A full-screen Home Assistant custom panel designed for Smart TVs and D-pad remotes.

## Version
0.1.0

## Features
- Native Home Assistant custom panel
- URL: `/tv-dashboard`
- Full-screen 16:9 layout
- Live Home Assistant entity states
- D-pad navigation: Up / Down / Left / Right
- OK / Enter activation
- Samsung Tizen Back key support
- Conditional alert cards
- Main navigation tiles
- Presence cards
- HACS-compatible repository structure

## Install with HACS
Add this repository as a custom repository in HACS:

https://github.com/dkouskousis/ha-tv-dashboard

Category: **Integration**

Then install **TV Dashboard** and restart Home Assistant.

After restart:

1. Open **Settings → Devices & services**
2. Click **Add integration**
3. Search for **TV Dashboard**
4. Add it

## Panel URL
```
/tv-dashboard
```

For the current local Home Assistant instance:

```
http://192.168.3.2:8123/tv-dashboard
```

## Current navigation targets
The TV home screen is independent of Lovelace, but the current menu tiles still open the existing Lovelace views under:

```
/new-minimalist/
```

Examples:
- Home → `/new-minimalist/house`
- Lights → `/new-minimalist/lights`
- Climate → `/new-minimalist/clima`
- Security → `/new-minimalist/security`
- Media → `/new-minimalist/media`
- Vacuum → `/new-minimalist/vacuum`
- Plants → `/new-minimalist/plants`
- Weather → `/new-minimalist/weather`
- Network → `/new-minimalist/network_lab`
- Energy → `/new-minimalist/energy`

## Remote keys
The frontend listens for:

- ArrowUp
- ArrowDown
- ArrowLeft
- ArrowRight
- Enter
- Space
- Escape
- BrowserBack / GoBack
- Samsung Tizen keyCode `10009`

The focus engine uses the real on-screen position of visible controls, so conditional cards can appear or disappear without breaking navigation.

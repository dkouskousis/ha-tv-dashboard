# TV Dashboard for Home Assistant

A standalone full-screen Home Assistant dashboard designed specifically for Smart TVs and D-pad remotes.

## Version

**0.2.0**

## TV-first design

The TV interface is now completely independent from the normal Lovelace dashboard.

It does **not** navigate to `/new-minimalist` or any other existing dashboard view.

Everything stays under:

```
/tv-dashboard
```

Internal pages use hash navigation, for example:

```
/tv-dashboard#/lights
/tv-dashboard#/climate
/tv-dashboard#/media
/tv-dashboard#/vacuum
```

## Design

- Pure black background
- Minimal dark cards
- Large typography for viewing from a distance
- 4-column 16:9 layout
- White high-contrast focus state
- Built specifically for remote-control navigation

## Included pages

- Home
- House
- Lights
- Security
- Media
- Climate
- Vacuum
- Plants
- Weather
- Network
- Energy

## Home screen

The Home screen includes:

- Conditional status/alert chips
- Weather chip
- Greeting and date
- House
- Lights
- Security
- Media
- Climate
- Vacuum
- Plants
- Network
- Dimitris / Vassilis / Flery / Guest presence

Weather and Energy are available through the top chips instead of duplicate large menu tiles.

## Direct Home Assistant control

The TV dashboard talks directly to Home Assistant through the frontend `hass` object.

Examples:

- Lights: lists and toggles `light.*`
- Media: lists `media_player.*` with play/pause, next/previous and volume
- Climate: lists `climate.*` with target temperature controls
- Vacuum: controls Roborock start/pause/stop/dock
- Security: displays `alarm_control_panel.home_alarm` and door/window/motion sensors
- Energy: displays power/energy sensors
- Plants: displays matching watering, irrigation, soil and moisture entities
- Network: displays matching server/network/UniFi/CPU/memory/uptime entities

## Remote navigation

Supported:

- Arrow Up
- Arrow Down
- Arrow Left
- Arrow Right
- Enter / OK
- Samsung Tizen Back key (`10009`)
- Escape / BrowserBack

Back returns to the TV Dashboard Home page instead of opening the normal Home Assistant dashboard.

## Install with HACS

Add this repository as a custom HACS repository:

https://github.com/dkouskousis/ha-tv-dashboard

Category: **Integration**

Then:

1. Install **TV Dashboard**
2. Restart Home Assistant
3. Open **Settings → Devices & services**
4. Click **Add integration**
5. Search for **TV Dashboard**

## TV URL

```
http://192.168.3.2:8123/tv-dashboard
```

This is the URL intended for the Samsung TV application.

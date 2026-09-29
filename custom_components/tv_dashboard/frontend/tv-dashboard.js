const VERSION = "0.2.0";

class TvDashboardPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._focusIndex = 0;
    this._renderQueued = false;
    this._keyHandler = this._onKeyDown.bind(this);
    this._hashHandler = () => this._queueRender();
  }

  set hass(value) {
    this._hass = value;
    this._queueRender();
  }

  get hass() {
    return this._hass;
  }

  set panel(value) {
    this._panel = value;
  }

  connectedCallback() {
    window.addEventListener("keydown", this._keyHandler, true);
    window.addEventListener("hashchange", this._hashHandler);
    this._clockTimer = window.setInterval(() => this._queueRender(), 60000);
    this._queueRender();
  }

  disconnectedCallback() {
    window.removeEventListener("keydown", this._keyHandler, true);
    window.removeEventListener("hashchange", this._hashHandler);
    if (this._clockTimer) window.clearInterval(this._clockTimer);
  }

  _queueRender() {
    if (this._renderQueued) return;
    this._renderQueued = true;
    requestAnimationFrame(() => {
      this._renderQueued = false;
      this.render();
    });
  }

  _state(entityId) {
    if (!this._hass || !this._hass.states) return undefined;
    return this._hass.states[entityId];
  }

  _is(entityId, state) {
    const entity = this._state(entityId);
    return entity && entity.state === state;
  }

  _friendly(entityId) {
    const entity = this._state(entityId);
    if (!entity) return entityId;
    return entity.attributes.friendly_name || entityId.split(".")[1].replaceAll("_", " ");
  }

  _page() {
    const raw = window.location.hash.replace(/^#\/?/, "");
    return raw || "home";
  }

  _go(page) {
    if (page === "home") {
      if (window.location.hash) window.location.hash = "#/home";
      else this._queueRender();
      return;
    }
    window.location.hash = `#/${page}`;
  }

  _showMoreInfo(entityId) {
    this.dispatchEvent(new CustomEvent("hass-more-info", {
      detail: { entityId },
      bubbles: true,
      composed: true,
    }));
  }

  async _call(domain, service, data) {
    await this._hass.callService(domain, service, data || {});
  }

  _toggleEntity(entityId) {
    const domain = entityId.split(".")[0];
    return this._call(domain, "toggle", { entity_id: entityId });
  }

  _focusables() {
    if (!this.shadowRoot) return [];
    return [...this.shadowRoot.querySelectorAll('[data-focusable="true"]')].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
  }

  _setFocused(el) {
    const all = this._focusables();
    all.forEach((item) => item.classList.remove("focused"));
    if (!el) return;
    el.classList.add("focused");
    try { el.focus({ preventScroll: true }); } catch (err) { el.focus(); }
    const idx = all.indexOf(el);
    if (idx >= 0) this._focusIndex = idx;
  }

  _ensureFocus() {
    const all = this._focusables();
    if (!all.length) return;
    const current = all.find((el) => el.classList.contains("focused"));
    if (current) return;
    this._setFocused(all[Math.min(this._focusIndex, all.length - 1)]);
  }

  _moveFocus(direction) {
    const items = this._focusables();
    if (!items.length) return;

    let current = items.find((el) => el.classList.contains("focused"));
    if (!current) {
      this._setFocused(items[0]);
      return;
    }

    const a = current.getBoundingClientRect();
    const ax = a.left + a.width / 2;
    const ay = a.top + a.height / 2;
    let best = null;
    let bestScore = Infinity;

    for (const candidate of items) {
      if (candidate === current) continue;
      const b = candidate.getBoundingClientRect();
      const bx = b.left + b.width / 2;
      const by = b.top + b.height / 2;
      const dx = bx - ax;
      const dy = by - ay;
      let valid = false;
      let primary = 0;
      let secondary = 0;

      if (direction === "left" && dx < -8) {
        valid = true; primary = Math.abs(dx); secondary = Math.abs(dy);
      } else if (direction === "right" && dx > 8) {
        valid = true; primary = Math.abs(dx); secondary = Math.abs(dy);
      } else if (direction === "up" && dy < -8) {
        valid = true; primary = Math.abs(dy); secondary = Math.abs(dx);
      } else if (direction === "down" && dy > 8) {
        valid = true; primary = Math.abs(dy); secondary = Math.abs(dx);
      }

      if (!valid) continue;
      const score = primary + secondary * 2.4;
      if (score < bestScore) {
        bestScore = score;
        best = candidate;
      }
    }

    if (best) this._setFocused(best);
  }

  _onKeyDown(event) {
    const key = event.key;
    const code = event.keyCode;

    if (key === "ArrowLeft" || code === 37) {
      event.preventDefault(); event.stopPropagation(); this._moveFocus("left"); return;
    }
    if (key === "ArrowRight" || code === 39) {
      event.preventDefault(); event.stopPropagation(); this._moveFocus("right"); return;
    }
    if (key === "ArrowUp" || code === 38) {
      event.preventDefault(); event.stopPropagation(); this._moveFocus("up"); return;
    }
    if (key === "ArrowDown" || code === 40) {
      event.preventDefault(); event.stopPropagation(); this._moveFocus("down"); return;
    }
    if (key === "Enter" || key === " " || code === 13) {
      const focused = this._focusables().find((el) => el.classList.contains("focused"));
      if (focused) {
        event.preventDefault();
        event.stopPropagation();
        focused.click();
      }
      return;
    }
    if (key === "BrowserBack" || key === "GoBack" || key === "Escape" || code === 10009) {
      event.preventDefault();
      event.stopPropagation();
      if (this._page() !== "home") this._go("home");
    }
  }

  _greeting() {
    const hour = new Date().getHours();
    if (hour < 5) return "Good night";
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }

  _date() {
    return new Intl.DateTimeFormat("en", {
      weekday: "long",
      day: "2-digit",
      month: "long",
    }).format(new Date());
  }

  _esc(value) {
    return String(value === undefined || value === null ? "" : value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  _fmtState(entityId) {
    const entity = this._state(entityId);
    if (!entity) return "Unavailable";
    const unit = entity.attributes.unit_of_measurement || "";
    return `${entity.state}${unit ? ` ${unit}` : ""}`;
  }

  _entitiesByDomain(domain) {
    return Object.values(this._hass.states)
      .filter((entity) => entity.entity_id.startsWith(`${domain}.`))
      .sort((a, b) => this._friendly(a.entity_id).localeCompare(this._friendly(b.entity_id)));
  }

  _matchingEntities(domains, terms) {
    const lowered = terms.map((term) => term.toLowerCase());
    return Object.values(this._hass.states)
      .filter((entity) => domains.includes(entity.entity_id.split(".")[0]))
      .filter((entity) => {
        const haystack = `${entity.entity_id} ${entity.attributes.friendly_name || ""}`.toLowerCase();
        return lowered.some((term) => haystack.includes(term));
      })
      .sort((a, b) => this._friendly(a.entity_id).localeCompare(this._friendly(b.entity_id)));
  }

  _chipData() {
    const chips = [];

    if (this._is("input_boolean.cpu_temperature_alert", "on")) {
      chips.push({ icon: "mdi:thermometer-alert", text: "", tone: "red", page: "network" });
    }

    if (this._is("input_boolean.ups_status", "on")) {
      chips.push({
        icon: "mdi:car-battery",
        text: `${this._state("sensor.powerwalker_battery_charge")?.state || "—"}%`,
        tone: "red",
        page: "network",
      });
    }

    if (this._is("input_boolean.energy_notification", "on")) {
      const power = Number(this._state("sensor.shellyem3_349454756093_channel_a_power")?.state);
      chips.push({ icon: "mdi:home-lightning-bolt-outline", text: `${Number.isFinite(power) ? Math.round(power) : "—"} W`, tone: "red", page: "energy" });
    }

    if (this._is("binary_sensor.mi_smart_humidifier_water_tank_empty", "on")) {
      chips.push({ icon: "mdi:water-remove", text: "Humidifier empty", tone: "red", page: "climate" });
    }

    if (this._is("input_boolean.low_humidity", "on")) {
      chips.push({ icon: "mdi:water-percent-alert", text: "", tone: "red", page: "climate" });
    }

    if (this._is("input_boolean.clicksend_notification", "on")) {
      chips.push({ icon: "mdi:alert", text: "Low credits", tone: "orange" });
    }

    if (this._is("input_boolean.stove_notification", "on")) {
      chips.push({ icon: "mdi:stove", text: "", tone: "orange", entity: "sensor.shellyem3_349454756093_channel_b_power" });
    }

    if (this._is("input_boolean.boiler", "on")) {
      chips.push({ icon: "mdi:water-boiler", text: "", tone: "orange", page: "house" });
    }

    const dockError = this._state("sensor.roborock_qrevo_dock_error")?.state;
    const vacError = this._state("sensor.roborock_qrevo_vacuum_error")?.state;
    const okVacStates = ["none", "Ok", "OK", "unknown", "unavailable"];
    if (dockError === "Error" || (vacError && !okVacStates.includes(vacError))) {
      chips.push({ icon: "mdi:robot-vacuum-alert", text: "Error", tone: "red", page: "vacuum" });
    } else {
      const status = this._state("sensor.roborock_qrevo_status")?.state;
      if (status && !["charging", "docked"].includes(status)) {
        chips.push({ icon: "mdi:robot-vacuum", text: "Cleaning", tone: "orange", page: "vacuum" });
      }
    }

    if (this._is("input_boolean.washing_machine", "on")) {
      chips.push({ icon: "mdi:washing-machine", text: "Finished", tone: "orange" });
    }

    if (this._is("input_boolean.dnd", "on")) {
      chips.push({ icon: "mdi:minus-circle-outline", text: "", tone: "purple", page: "house" });
    }

    if (this._is("input_boolean.heating", "on")) {
      chips.push({ icon: "mdi:heating-coil", text: "", tone: "orange", page: "climate" });
    }

    if (this._is("input_boolean.guest", "on")) {
      chips.push({ icon: "mdi:account-clock", text: "", tone: "blue", page: "house" });
    }

    if (this._is("input_boolean.vacation", "on")) {
      chips.push({ icon: "mdi:airplane", text: "", tone: "blue", page: "house" });
    }

    const weather = this._state("weather.openweathermap");
    if (weather) {
      chips.push({
        icon: "mdi:weather-partly-cloudy",
        text: `${weather.attributes.temperature ?? "—"}°`,
        tone: "white",
        page: "weather",
      });
    }

    return chips;
  }

  _renderChips() {
    const chips = this._chipData();
    return `
      <div class="chips">
        ${chips.map((chip, index) => {
          const actionable = Boolean(chip.page || chip.entity);
          return `
            <button class="chip tone-${chip.tone}" data-chip="${index}" data-focusable="${actionable}" tabindex="${actionable ? "0" : "-1"}">
              <ha-icon icon="${chip.icon}"></ha-icon>
              ${chip.text ? `<span>${this._esc(chip.text)}</span>` : ""}
            </button>`;
        }).join("")}
      </div>`;
  }

  _renderHeader(title, subtitle, showBack = true) {
    return `
      <header class="page-header">
        <div class="header-left">
          ${showBack ? `<button class="back-button" data-action="back" data-focusable="true" tabindex="0"><ha-icon icon="mdi:chevron-left"></ha-icon></button>` : ""}
          <div>
            <div class="page-title">${this._esc(title)}</div>
            ${subtitle ? `<div class="page-subtitle">${this._esc(subtitle)}</div>` : ""}
          </div>
        </div>
        <div class="clock">${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
      </header>`;
  }

  _renderHome() {
    const menu = [
      ["House", "Devices & modes", "mdi:home-outline", "house"],
      ["Lights", "Lighting", "mdi:lamps", "lights"],
      ["Security", "Alarm & sensors", "mdi:shield-home-outline", "security"],
      ["Media", "Music & players", "mdi:music", "media"],
      ["Climate", "Temperature & air", "mdi:home-thermometer-outline", "climate"],
      ["Vacuum", "Roborock Q Revo", "mdi:robot-vacuum", "vacuum"],
      ["Plants", "Watering & sensors", "mdi:flower-outline", "plants"],
      ["Network", "Server & network", "mdi:server-network-outline", "network"],
    ];

    const people = [
      ["Dimitris", "person.dimitris", "mdi:account"],
      ["Vassilis", "person.vassilis", "mdi:account"],
      ["Flery", "person.fleri", "mdi:dog"],
      ["Guest", "person.guest", "mdi:account-clock"],
    ];

    return `
      ${this._renderChips()}
      <section class="home-hero">
        <div>
          <div class="eyebrow">TV DASHBOARD</div>
          <h1>${this._greeting()}</h1>
          <p>${this._date()}</p>
        </div>
        <ha-icon icon="mdi:home"></ha-icon>
      </section>

      <section class="menu-grid">
        ${menu.map(([title, subtitle, icon, page], index) => `
          <button class="nav-card" data-menu="${index}" data-page="${page}" data-focusable="true" tabindex="0">
            <ha-icon icon="${icon}"></ha-icon>
            <div class="nav-title">${title}</div>
            <div class="nav-subtitle">${subtitle}</div>
          </button>`).join("")}
      </section>

      <section class="people-row">
        ${people.map(([name, entityId], index) => {
          const state = this._state(entityId)?.state || "unknown";
          return `
            <button class="person-card ${state === "home" ? "is-home" : ""}" data-person="${index}" data-entity="${entityId}" data-focusable="true" tabindex="0">
              <div class="presence-dot"></div>
              <div>
                <div class="person-name">${name}</div>
                <div class="person-state">${this._esc(state.replaceAll("_", " "))}</div>
              </div>
            </button>`;
        }).join("")}
      </section>`;
  }

  _renderHouse() {
    const items = [
      ["Boiler", "input_boolean.boiler", "mdi:water-boiler"],
      ["Do not disturb", "input_boolean.dnd", "mdi:minus-circle-outline"],
      ["Guest mode", "input_boolean.guest", "mdi:account-clock"],
      ["Vacation mode", "input_boolean.vacation", "mdi:airplane"],
      ["Heating", "input_boolean.heating", "mdi:heating-coil"],
      ["Washing machine", "input_boolean.washing_machine", "mdi:washing-machine"],
    ];

    return `
      ${this._renderHeader("House", "Devices & home modes")}
      <section class="control-grid">
        ${items.map(([name, entityId, icon], index) => {
          const state = this._state(entityId)?.state || "unavailable";
          return this._entityTile(name, entityId, icon, state, index, true);
        }).join("")}
      </section>`;
  }

  _renderLights() {
    const lights = this._entitiesByDomain("light");
    return `
      ${this._renderHeader("Lights", `${lights.length} lights`)}
      <section class="control-grid">
        ${lights.map((entity, index) => this._entityTile(
          this._friendly(entity.entity_id),
          entity.entity_id,
          "mdi:lightbulb-outline",
          entity.state,
          index,
          true
        )).join("") || this._empty("No light entities found")}
      </section>`;
  }

  _renderSecurity() {
    const alarm = this._state("alarm_control_panel.home_alarm");
    const sensors = Object.values(this._hass.states)
      .filter((entity) => entity.entity_id.startsWith("binary_sensor."))
      .filter((entity) => ["door", "window", "opening", "motion", "occupancy"].includes(entity.attributes.device_class))
      .sort((a, b) => this._friendly(a.entity_id).localeCompare(this._friendly(b.entity_id)));

    return `
      ${this._renderHeader("Security", "Alarm & sensors")}
      <section class="hero-state ${alarm && alarm.state !== "disarmed" ? "active" : ""}">
        <ha-icon icon="mdi:shield-home-outline"></ha-icon>
        <div>
          <div class="hero-label">Home alarm</div>
          <div class="hero-value">${this._esc(alarm ? alarm.state.replaceAll("_", " ") : "Unavailable")}</div>
        </div>
      </section>
      <section class="list-grid">
        ${sensors.map((entity, index) => this._sensorTile(entity, index)).join("") || this._empty("No security sensors found")}
      </section>`;
  }

  _renderMedia() {
    const players = this._entitiesByDomain("media_player");
    return `
      ${this._renderHeader("Media", `${players.length} media players`)}
      <section class="list-grid">
        ${players.map((entity, index) => `
          <div class="media-card">
            <button class="media-main" data-focusable="true" data-info="${entity.entity_id}" tabindex="0">
              <ha-icon icon="mdi:speaker"></ha-icon>
              <div class="media-copy">
                <div class="item-name">${this._esc(this._friendly(entity.entity_id))}</div>
                <div class="item-state">${this._esc(entity.state)}</div>
                ${entity.attributes.media_title ? `<div class="media-title">${this._esc(entity.attributes.media_title)}</div>` : ""}
              </div>
            </button>
            <div class="media-actions">
              <button data-focusable="true" data-media="prev" data-entity="${entity.entity_id}" tabindex="0"><ha-icon icon="mdi:skip-previous"></ha-icon></button>
              <button data-focusable="true" data-media="play" data-entity="${entity.entity_id}" tabindex="0"><ha-icon icon="mdi:play-pause"></ha-icon></button>
              <button data-focusable="true" data-media="next" data-entity="${entity.entity_id}" tabindex="0"><ha-icon icon="mdi:skip-next"></ha-icon></button>
              <button data-focusable="true" data-media="down" data-entity="${entity.entity_id}" tabindex="0"><ha-icon icon="mdi:volume-minus"></ha-icon></button>
              <button data-focusable="true" data-media="up" data-entity="${entity.entity_id}" tabindex="0"><ha-icon icon="mdi:volume-plus"></ha-icon></button>
            </div>
          </div>`).join("") || this._empty("No media players found")}
      </section>`;
  }

  _renderClimate() {
    const climates = this._entitiesByDomain("climate");
    const airSensors = Object.values(this._hass.states)
      .filter((entity) => entity.entity_id.startsWith("sensor."))
      .filter((entity) => ["temperature", "humidity", "pm25", "aqi"].includes(entity.attributes.device_class) || /temperature|humidity|pm2|aqi|air quality/i.test(`${entity.entity_id} ${entity.attributes.friendly_name || ""}`))
      .sort((a, b) => this._friendly(a.entity_id).localeCompare(this._friendly(b.entity_id)))
      .slice(0, 12);

    return `
      ${this._renderHeader("Climate", "Temperature & air")}
      <section class="list-grid">
        ${climates.map((entity) => {
          const current = entity.attributes.current_temperature;
          const target = entity.attributes.temperature;
          return `
            <div class="climate-card">
              <button class="climate-main" data-focusable="true" data-info="${entity.entity_id}" tabindex="0">
                <ha-icon icon="mdi:thermostat"></ha-icon>
                <div>
                  <div class="item-name">${this._esc(this._friendly(entity.entity_id))}</div>
                  <div class="climate-temp">${current ?? "—"}°</div>
                  <div class="item-state">Target ${target ?? "—"}° · ${this._esc(entity.state)}</div>
                </div>
              </button>
              <div class="climate-actions">
                <button data-focusable="true" data-climate="minus" data-entity="${entity.entity_id}" tabindex="0"><ha-icon icon="mdi:minus"></ha-icon></button>
                <button data-focusable="true" data-climate="plus" data-entity="${entity.entity_id}" tabindex="0"><ha-icon icon="mdi:plus"></ha-icon></button>
              </div>
            </div>`;
        }).join("") || this._empty("No climate entities found")}
      </section>
      <div class="section-title">Air & sensors</div>
      <section class="sensor-strip">
        ${airSensors.map((entity, index) => this._sensorTile(entity, index)).join("") || this._empty("No air sensors found")}
      </section>`;
  }

  _renderVacuum() {
    const vacuum = this._state("vacuum.roborock_qrevo") || this._entitiesByDomain("vacuum")[0];
    const status = this._state("sensor.roborock_qrevo_status")?.state || vacuum?.state || "unknown";
    const dockError = this._state("sensor.roborock_qrevo_dock_error")?.state || "unknown";
    const vacError = this._state("sensor.roborock_qrevo_vacuum_error")?.state || "unknown";

    return `
      ${this._renderHeader("Vacuum", "Roborock Q Revo")}
      <section class="vacuum-hero">
        <ha-icon icon="mdi:robot-vacuum"></ha-icon>
        <div class="vacuum-status">${this._esc(status.replaceAll("_", " "))}</div>
        <div class="vacuum-errors">Dock: ${this._esc(dockError)} · Vacuum: ${this._esc(vacError)}</div>
      </section>
      ${vacuum ? `
        <section class="action-row">
          <button data-focusable="true" data-vacuum="start" data-entity="${vacuum.entity_id}" tabindex="0"><ha-icon icon="mdi:play"></ha-icon><span>Start</span></button>
          <button data-focusable="true" data-vacuum="pause" data-entity="${vacuum.entity_id}" tabindex="0"><ha-icon icon="mdi:pause"></ha-icon><span>Pause</span></button>
          <button data-focusable="true" data-vacuum="stop" data-entity="${vacuum.entity_id}" tabindex="0"><ha-icon icon="mdi:stop"></ha-icon><span>Stop</span></button>
          <button data-focusable="true" data-vacuum="dock" data-entity="${vacuum.entity_id}" tabindex="0"><ha-icon icon="mdi:home-import-outline"></ha-icon><span>Dock</span></button>
        </section>` : this._empty("No vacuum entity found")}`;
  }

  _renderPlants() {
    const entities = this._matchingEntities(
      ["sensor", "binary_sensor", "switch", "valve", "input_boolean"],
      ["plant", "soil", "moisture", "watering", "irrigation", "balcony", "garden"]
    ).slice(0, 24);

    return `
      ${this._renderHeader("Plants", "Watering & sensors")}
      <section class="list-grid">
        ${entities.map((entity, index) => this._genericTile(entity, index)).join("") || this._empty("No plant or watering entities found")}
      </section>`;
  }

  _renderWeather() {
    const weather = this._state("weather.openweathermap");
    if (!weather) return `${this._renderHeader("Weather", "Forecast")}${this._empty("weather.openweathermap not found")}`;
    const temp = weather.attributes.temperature ?? "—";
    const humidity = weather.attributes.humidity ?? "—";
    const wind = weather.attributes.wind_speed ?? "—";
    const unit = weather.attributes.wind_speed_unit || "";
    const forecast = Array.isArray(weather.attributes.forecast) ? weather.attributes.forecast.slice(0, 6) : [];

    return `
      ${this._renderHeader("Weather", "OpenWeatherMap")}
      <section class="weather-hero">
        <ha-icon icon="mdi:weather-partly-cloudy"></ha-icon>
        <div>
          <div class="weather-temp">${temp}°</div>
          <div class="weather-condition">${this._esc(weather.state.replaceAll("_", " "))}</div>
        </div>
        <div class="weather-meta">
          <div><span>Humidity</span><strong>${humidity}%</strong></div>
          <div><span>Wind</span><strong>${wind} ${unit}</strong></div>
        </div>
      </section>
      ${forecast.length ? `<section class="forecast-row">${forecast.map((item) => `
        <div class="forecast-card">
          <div>${this._esc(new Date(item.datetime).toLocaleDateString([], { weekday: "short" }))}</div>
          <strong>${item.temperature ?? "—"}°</strong>
          <span>${this._esc(item.condition || "")}</span>
        </div>`).join("")}</section>` : ""}`;
  }

  _renderNetwork() {
    const entities = this._matchingEntities(
      ["sensor", "binary_sensor", "update"],
      ["network", "server", "unifi", "internet", "wan", "lan", "ping", "uptime", "cpu", "memory", "disk", "temperature", "speedtest"]
    ).slice(0, 28);

    return `
      ${this._renderHeader("Network", "Server & network")}
      <section class="list-grid">
        ${entities.map((entity, index) => this._genericTile(entity, index)).join("") || this._empty("No matching network entities found")}
      </section>`;
  }

  _renderEnergy() {
    const preferred = [
      "sensor.shellyem3_349454756093_channel_a_power",
      "sensor.shellyem3_349454756093_channel_b_power",
    ].map((id) => this._state(id)).filter(Boolean);

    const others = Object.values(this._hass.states)
      .filter((entity) => entity.entity_id.startsWith("sensor."))
      .filter((entity) => ["power", "energy"].includes(entity.attributes.device_class))
      .filter((entity) => !preferred.some((item) => item.entity_id === entity.entity_id))
      .sort((a, b) => this._friendly(a.entity_id).localeCompare(this._friendly(b.entity_id)))
      .slice(0, 18);

    const entities = [...preferred, ...others];
    return `
      ${this._renderHeader("Energy", "Power consumption")}
      <section class="energy-grid">
        ${entities.map((entity, index) => this._sensorTile(entity, index, true)).join("") || this._empty("No power or energy sensors found")}
      </section>`;
  }

  _entityTile(name, entityId, icon, state, index, canToggle) {
    const active = ["on", "open", "playing", "heat", "cool"].includes(String(state));
    return `
      <button class="control-card ${active ? "active" : ""}" data-focusable="true" data-entity="${entityId}" data-toggle="${canToggle ? "true" : "false"}" tabindex="0">
        <ha-icon icon="${icon}"></ha-icon>
        <div class="item-name">${this._esc(name)}</div>
        <div class="item-state">${this._esc(String(state).replaceAll("_", " "))}</div>
      </button>`;
  }

  _sensorTile(entity, index, large = false) {
    const state = entity.state;
    const unit = entity.attributes.unit_of_measurement || "";
    const active = ["on", "open", "detected"].includes(state);
    return `
      <button class="sensor-card ${large ? "large" : ""} ${active ? "active" : ""}" data-info="${entity.entity_id}" data-focusable="true" tabindex="0">
        <div class="sensor-name">${this._esc(this._friendly(entity.entity_id))}</div>
        <div class="sensor-value">${this._esc(state)}${unit ? ` <span>${this._esc(unit)}</span>` : ""}</div>
      </button>`;
  }

  _genericTile(entity, index) {
    const domain = entity.entity_id.split(".")[0];
    const toggleable = ["switch", "input_boolean", "light", "fan", "valve"].includes(domain);
    const active = ["on", "open", "opening"].includes(entity.state);
    return `
      <button class="sensor-card ${active ? "active" : ""}" data-focusable="true" ${toggleable ? `data-toggle="true" data-entity="${entity.entity_id}"` : `data-info="${entity.entity_id}"`} tabindex="0">
        <div class="sensor-name">${this._esc(this._friendly(entity.entity_id))}</div>
        <div class="sensor-value small">${this._esc(this._fmtState(entity.entity_id))}</div>
      </button>`;
  }

  _empty(text) {
    return `<div class="empty">${this._esc(text)}</div>`;
  }

  _styles() {
    return `
      :host {
        display: block;
        min-height: 100vh;
        background: #000;
        color: #fff;
        font-family: Inter, Roboto, Arial, sans-serif;
        overflow: auto;
      }
      * { box-sizing: border-box; }
      button { font: inherit; color: inherit; border: 0; }
      .shell { width: min(1760px, calc(100vw - 80px)); margin: 0 auto; padding: 30px 0 44px; }
      .chips { min-height: 48px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 22px; }
      .chip { height: 42px; padding: 0 14px; display: inline-flex; align-items: center; gap: 8px; border-radius: 21px; background: #111; border: 1px solid #252525; color: #fff; }
      .chip ha-icon { --mdc-icon-size: 22px; }
      .chip span { font-size: 15px; font-weight: 600; }
      .tone-red ha-icon { color: #ff5a5f; } .tone-orange ha-icon { color: #ff9f43; } .tone-purple ha-icon { color: #b78cff; } .tone-blue ha-icon { color: #55a7ff; } .tone-white ha-icon { color: #fff; }
      .home-hero { min-height: 150px; display: flex; align-items: center; justify-content: space-between; padding: 0 8px 8px; }
      .home-hero h1 { margin: 7px 0 5px; font-size: 54px; line-height: 1; letter-spacing: -1.6px; font-weight: 700; }
      .home-hero p { margin: 0; color: #8c8c8c; font-size: 21px; }
      .home-hero > ha-icon { --mdc-icon-size: 72px; color: #242424; }
      .eyebrow { font-size: 12px; letter-spacing: 2px; color: #666; font-weight: 700; }
      .menu-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 18px; }
      .nav-card, .control-card { min-height: 180px; border-radius: 24px; background: #101010; border: 1px solid #222; padding: 24px; text-align: left; transition: transform .12s ease, border-color .12s ease, background .12s ease; }
      .nav-card ha-icon, .control-card ha-icon { --mdc-icon-size: 45px; color: #e8e8e8; }
      .nav-title { margin-top: 34px; font-size: 25px; font-weight: 650; letter-spacing: -.35px; }
      .nav-subtitle { margin-top: 7px; color: #777; font-size: 15px; }
      .people-row { margin-top: 18px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
      .person-card { min-height: 74px; border-radius: 20px; background: #0c0c0c; border: 1px solid #1d1d1d; display: flex; align-items: center; gap: 13px; padding: 15px 18px; text-align: left; }
      .presence-dot { width: 10px; height: 10px; border-radius: 50%; background: #555; }
      .person-card.is-home .presence-dot { background: #52d273; box-shadow: 0 0 14px rgba(82,210,115,.45); }
      .person-name { font-size: 17px; font-weight: 650; } .person-state { margin-top: 2px; font-size: 13px; text-transform: capitalize; color: #707070; }
      .page-header { min-height: 92px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
      .header-left { display: flex; align-items: center; gap: 18px; }
      .back-button { width: 54px; height: 54px; border-radius: 16px; background: #0e0e0e; border: 1px solid #222; display: grid; place-items: center; }
      .back-button ha-icon { --mdc-icon-size: 32px; }
      .page-title { font-size: 38px; font-weight: 700; letter-spacing: -1px; } .page-subtitle { margin-top: 4px; color: #727272; font-size: 16px; }
      .clock { color: #666; font-size: 24px; font-variant-numeric: tabular-nums; }
      .control-grid, .list-grid, .energy-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
      .control-card { min-height: 155px; }
      .control-card .item-name { margin-top: 24px; }
      .control-card.active, .sensor-card.active { background: #181818; border-color: #4f4f4f; }
      .item-name { font-size: 20px; font-weight: 650; } .item-state { margin-top: 6px; color: #777; font-size: 14px; text-transform: capitalize; }
      .hero-state, .vacuum-hero, .weather-hero { min-height: 180px; border-radius: 28px; background: #0d0d0d; border: 1px solid #222; display: flex; align-items: center; gap: 26px; padding: 30px 34px; margin-bottom: 18px; }
      .hero-state ha-icon, .vacuum-hero ha-icon, .weather-hero > ha-icon { --mdc-icon-size: 72px; color: #ddd; }
      .hero-state.active { border-color: #8a3a3a; }
      .hero-label { color: #777; font-size: 16px; } .hero-value { margin-top: 4px; font-size: 34px; font-weight: 700; text-transform: capitalize; }
      .sensor-card { min-height: 120px; border-radius: 20px; background: #0d0d0d; border: 1px solid #202020; padding: 19px; text-align: left; }
      .sensor-card.large { min-height: 145px; }
      .sensor-name { color: #898989; font-size: 14px; line-height: 1.25; }
      .sensor-value { margin-top: 15px; font-size: 28px; font-weight: 700; } .sensor-value span { color: #767676; font-size: 15px; font-weight: 500; } .sensor-value.small { font-size: 19px; }
      .media-card, .climate-card { border-radius: 24px; background: #0d0d0d; border: 1px solid #202020; overflow: hidden; }
      .media-main, .climate-main { width: 100%; min-height: 150px; background: transparent; display: flex; align-items: center; gap: 18px; padding: 24px; text-align: left; }
      .media-main ha-icon, .climate-main ha-icon { --mdc-icon-size: 46px; color: #e4e4e4; }
      .media-copy { min-width: 0; } .media-title { margin-top: 8px; color: #b0b0b0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .media-actions { display: grid; grid-template-columns: repeat(5, 1fr); border-top: 1px solid #1e1e1e; }
      .media-actions button, .climate-actions button { height: 56px; background: #111; border-right: 1px solid #1e1e1e; }
      .media-actions button:last-child, .climate-actions button:last-child { border-right: 0; }
      .media-actions ha-icon, .climate-actions ha-icon { --mdc-icon-size: 24px; }
      .climate-temp { margin-top: 8px; font-size: 34px; font-weight: 700; }
      .climate-actions { display: grid; grid-template-columns: 1fr 1fr; border-top: 1px solid #1e1e1e; }
      .section-title { margin: 30px 0 12px; color: #777; font-size: 15px; font-weight: 650; text-transform: uppercase; letter-spacing: 1px; }
      .sensor-strip { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
      .vacuum-hero { flex-direction: column; justify-content: center; text-align: center; min-height: 300px; }
      .vacuum-status { font-size: 38px; font-weight: 700; text-transform: capitalize; } .vacuum-errors { color: #777; font-size: 15px; }
      .action-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
      .action-row button { min-height: 92px; border-radius: 20px; background: #0f0f0f; border: 1px solid #222; display: flex; align-items: center; justify-content: center; gap: 10px; font-weight: 650; }
      .action-row ha-icon { --mdc-icon-size: 28px; }
      .weather-hero { justify-content: space-between; }
      .weather-temp { font-size: 62px; font-weight: 750; letter-spacing: -2px; } .weather-condition { color: #777; font-size: 18px; text-transform: capitalize; }
      .weather-meta { margin-left: auto; display: flex; gap: 50px; } .weather-meta div { display: flex; flex-direction: column; gap: 6px; } .weather-meta span { color: #666; font-size: 13px; text-transform: uppercase; } .weather-meta strong { font-size: 22px; }
      .forecast-row { display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; }
      .forecast-card { min-height: 120px; border-radius: 18px; background: #0d0d0d; border: 1px solid #202020; padding: 16px; display: flex; flex-direction: column; justify-content: space-between; } .forecast-card div, .forecast-card span { color: #777; font-size: 13px; text-transform: capitalize; } .forecast-card strong { font-size: 25px; }
      .empty { grid-column: 1 / -1; min-height: 160px; border: 1px dashed #242424; border-radius: 20px; display: grid; place-items: center; color: #666; }
      [data-focusable="true"] { cursor: pointer; transition: transform .12s ease, border-color .12s ease, background .12s ease, box-shadow .12s ease; }
      [data-focusable="true"].focused { outline: none; transform: scale(1.035); border-color: #fff !important; box-shadow: 0 0 0 3px #fff; z-index: 5; }
      [data-focusable="true"]:focus { outline: none; }
      .version { margin-top: 24px; text-align: right; color: #333; font-size: 12px; }
      @media (max-width: 1200px) { .shell { width: calc(100vw - 40px); } .menu-grid, .control-grid, .list-grid, .energy-grid, .sensor-strip { grid-template-columns: repeat(3, minmax(0, 1fr)); } .people-row { grid-template-columns: repeat(2, 1fr); } .forecast-row { grid-template-columns: repeat(3, 1fr); } }
    `;
  }

  _wireEvents(page) {
    this.shadowRoot.querySelectorAll('[data-action="back"]').forEach((el) => el.addEventListener("click", () => this._go("home")));
    this.shadowRoot.querySelectorAll("[data-page]").forEach((el) => el.addEventListener("click", () => this._go(el.dataset.page)));
    this.shadowRoot.querySelectorAll("[data-info]").forEach((el) => el.addEventListener("click", () => this._showMoreInfo(el.dataset.info)));
    this.shadowRoot.querySelectorAll('[data-toggle="true"]').forEach((el) => el.addEventListener("click", () => this._toggleEntity(el.dataset.entity)));

    const chips = this._chipData();
    this.shadowRoot.querySelectorAll("[data-chip]").forEach((el) => {
      const chip = chips[Number(el.dataset.chip)];
      if (!chip) return;
      if (chip.page) el.addEventListener("click", () => this._go(chip.page));
      else if (chip.entity) el.addEventListener("click", () => this._showMoreInfo(chip.entity));
    });

    this.shadowRoot.querySelectorAll("[data-person]").forEach((el) => el.addEventListener("click", () => this._showMoreInfo(el.dataset.entity)));

    this.shadowRoot.querySelectorAll("[data-media]").forEach((el) => el.addEventListener("click", () => {
      const entityId = el.dataset.entity;
      const action = el.dataset.media;
      if (action === "play") this._call("media_player", "media_play_pause", { entity_id: entityId });
      if (action === "prev") this._call("media_player", "media_previous_track", { entity_id: entityId });
      if (action === "next") this._call("media_player", "media_next_track", { entity_id: entityId });
      if (action === "down") this._call("media_player", "volume_down", { entity_id: entityId });
      if (action === "up") this._call("media_player", "volume_up", { entity_id: entityId });
    }));

    this.shadowRoot.querySelectorAll("[data-climate]").forEach((el) => el.addEventListener("click", () => {
      const entity = this._state(el.dataset.entity);
      if (!entity) return;
      const step = Number(entity.attributes.target_temp_step || 0.5);
      const current = Number(entity.attributes.temperature);
      if (!Number.isFinite(current)) return;
      const temperature = el.dataset.climate === "plus" ? current + step : current - step;
      this._call("climate", "set_temperature", { entity_id: entity.entity_id, temperature });
    }));

    this.shadowRoot.querySelectorAll("[data-vacuum]").forEach((el) => el.addEventListener("click", () => {
      const entityId = el.dataset.entity;
      const action = el.dataset.vacuum;
      if (action === "start") this._call("vacuum", "start", { entity_id: entityId });
      if (action === "pause") this._call("vacuum", "pause", { entity_id: entityId });
      if (action === "stop") this._call("vacuum", "stop", { entity_id: entityId });
      if (action === "dock") this._call("vacuum", "return_to_base", { entity_id: entityId });
    }));
  }

  render() {
    if (!this.shadowRoot || !this._hass) return;
    const page = this._page();
    let content = "";

    if (page === "home") content = this._renderHome();
    else if (page === "house") content = this._renderHouse();
    else if (page === "lights") content = this._renderLights();
    else if (page === "security") content = this._renderSecurity();
    else if (page === "media") content = this._renderMedia();
    else if (page === "climate") content = this._renderClimate();
    else if (page === "vacuum") content = this._renderVacuum();
    else if (page === "plants") content = this._renderPlants();
    else if (page === "weather") content = this._renderWeather();
    else if (page === "network") content = this._renderNetwork();
    else if (page === "energy") content = this._renderEnergy();
    else content = this._renderHome();

    this.shadowRoot.innerHTML = `
      <style>${this._styles()}</style>
      <main class="shell">
        ${content}
        <div class="version">TV Dashboard v${VERSION}</div>
      </main>`;

    this._wireEvents(page);
    requestAnimationFrame(() => this._ensureFocus());
  }
}

if (!customElements.get("tv-dashboard-panel")) {
  customElements.define("tv-dashboard-panel", TvDashboardPanel);
}

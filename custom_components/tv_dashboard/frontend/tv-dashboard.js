var TV_DASHBOARD_VERSION = "0.2.1";

class TvDashboardPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._focusIndex = 0;
    this._keyHandler = this._onKeyDown.bind(this);
    this._hashHandler = this._render.bind(this);
  }

  set hass(value) {
    this._hass = value;
    this._render();
  }

  get hass() {
    return this._hass;
  }

  set panel(value) {
    this._panel = value;
  }

  connectedCallback() {
    document.documentElement.style.background = "#000";
    document.body.style.background = "#000";
    document.body.style.margin = "0";

    window.addEventListener("keydown", this._keyHandler, true);
    window.addEventListener("hashchange", this._hashHandler);

    var self = this;
    this._clockTimer = window.setInterval(function () {
      self._render();
    }, 60000);

    this._render();
  }

  disconnectedCallback() {
    window.removeEventListener("keydown", this._keyHandler, true);
    window.removeEventListener("hashchange", this._hashHandler);

    if (this._clockTimer) {
      window.clearInterval(this._clockTimer);
    }
  }

  _state(id) {
    if (!this._hass || !this._hass.states) {
      return null;
    }
    return this._hass.states[id] || null;
  }

  _friendly(id) {
    var entity = this._state(id);
    if (entity && entity.attributes && entity.attributes.friendly_name) {
      return entity.attributes.friendly_name;
    }

    var parts = id.split(".");
    var name = parts.length > 1 ? parts[1] : id;
    return name.split("_").join(" ");
  }

  _page() {
    var hash = window.location.hash || "";
    hash = hash.replace(/^#\/?/, "");
    return hash || "home";
  }

  _go(page) {
    window.location.hash = "#/" + page;
  }

  _escape(value) {
    var text = String(value === undefined || value === null ? "" : value);
    return text
      .split("&").join("&amp;")
      .split("<").join("&lt;")
      .split(">").join("&gt;")
      .split('"').join("&quot;");
  }

  _showMoreInfo(entityId) {
    this.dispatchEvent(new CustomEvent("hass-more-info", {
      detail: { entityId: entityId },
      bubbles: true,
      composed: true
    }));
  }

  _call(domain, service, data) {
    if (!this._hass) {
      return;
    }
    this._hass.callService(domain, service, data || {});
  }

  _toggle(id) {
    var domain = id.split(".")[0];
    this._call(domain, "toggle", { entity_id: id });
  }

  _focusables() {
    if (!this.shadowRoot) {
      return [];
    }

    var nodes = this.shadowRoot.querySelectorAll('[data-focusable="true"]');
    var result = [];

    for (var i = 0; i < nodes.length; i++) {
      var rect = nodes[i].getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        result.push(nodes[i]);
      }
    }

    return result;
  }

  _setFocus(el) {
    var items = this._focusables();

    for (var i = 0; i < items.length; i++) {
      items[i].classList.remove("focused");
    }

    if (!el) {
      return;
    }

    el.classList.add("focused");

    try {
      el.focus({ preventScroll: true });
    } catch (err) {
      el.focus();
    }

    var index = items.indexOf(el);
    if (index >= 0) {
      this._focusIndex = index;
    }
  }

  _ensureFocus() {
    var items = this._focusables();
    if (!items.length) {
      return;
    }

    for (var i = 0; i < items.length; i++) {
      if (items[i].classList.contains("focused")) {
        return;
      }
    }

    var index = this._focusIndex;
    if (index >= items.length) {
      index = items.length - 1;
    }

    this._setFocus(items[index]);
  }

  _move(direction) {
    var items = this._focusables();

    if (!items.length) {
      return;
    }

    var current = null;
    var i;

    for (i = 0; i < items.length; i++) {
      if (items[i].classList.contains("focused")) {
        current = items[i];
        break;
      }
    }

    if (!current) {
      this._setFocus(items[0]);
      return;
    }

    var a = current.getBoundingClientRect();
    var ax = a.left + a.width / 2;
    var ay = a.top + a.height / 2;
    var best = null;
    var bestScore = Number.POSITIVE_INFINITY;

    for (i = 0; i < items.length; i++) {
      var candidate = items[i];

      if (candidate === current) {
        continue;
      }

      var b = candidate.getBoundingClientRect();
      var bx = b.left + b.width / 2;
      var by = b.top + b.height / 2;
      var dx = bx - ax;
      var dy = by - ay;
      var valid = false;
      var primary = 0;
      var secondary = 0;

      if (direction === "left" && dx < -8) {
        valid = true;
        primary = Math.abs(dx);
        secondary = Math.abs(dy);
      } else if (direction === "right" && dx > 8) {
        valid = true;
        primary = Math.abs(dx);
        secondary = Math.abs(dy);
      } else if (direction === "up" && dy < -8) {
        valid = true;
        primary = Math.abs(dy);
        secondary = Math.abs(dx);
      } else if (direction === "down" && dy > 8) {
        valid = true;
        primary = Math.abs(dy);
        secondary = Math.abs(dx);
      }

      if (!valid) {
        continue;
      }

      var score = primary + secondary * 2.4;

      if (score < bestScore) {
        bestScore = score;
        best = candidate;
      }
    }

    if (best) {
      this._setFocus(best);
    }
  }

  _onKeyDown(event) {
    var key = event.key || "";
    var code = event.keyCode || 0;

    if (key === "ArrowLeft" || code === 37) {
      event.preventDefault();
      event.stopPropagation();
      this._move("left");
      return;
    }

    if (key === "ArrowRight" || code === 39) {
      event.preventDefault();
      event.stopPropagation();
      this._move("right");
      return;
    }

    if (key === "ArrowUp" || code === 38) {
      event.preventDefault();
      event.stopPropagation();
      this._move("up");
      return;
    }

    if (key === "ArrowDown" || code === 40) {
      event.preventDefault();
      event.stopPropagation();
      this._move("down");
      return;
    }

    if (key === "Enter" || key === " " || code === 13) {
      var items = this._focusables();
      for (var i = 0; i < items.length; i++) {
        if (items[i].classList.contains("focused")) {
          event.preventDefault();
          event.stopPropagation();
          items[i].click();
          return;
        }
      }
    }

    if (
      key === "BrowserBack" ||
      key === "GoBack" ||
      key === "Escape" ||
      code === 10009
    ) {
      event.preventDefault();
      event.stopPropagation();

      if (this._page() !== "home") {
        this._go("home");
      }
    }
  }

  _entities(domain) {
    var result = [];

    if (!this._hass || !this._hass.states) {
      return result;
    }

    var keys = Object.keys(this._hass.states);

    for (var i = 0; i < keys.length; i++) {
      var id = keys[i];
      if (id.indexOf(domain + ".") === 0) {
        result.push(this._hass.states[id]);
      }
    }

    var self = this;

    result.sort(function (a, b) {
      return self._friendly(a.entity_id).localeCompare(self._friendly(b.entity_id));
    });

    return result;
  }

  _matching(domains, terms) {
    var result = [];

    if (!this._hass || !this._hass.states) {
      return result;
    }

    var keys = Object.keys(this._hass.states);

    for (var i = 0; i < keys.length; i++) {
      var entity = this._hass.states[keys[i]];
      var domain = entity.entity_id.split(".")[0];

      if (domains.indexOf(domain) === -1) {
        continue;
      }

      var friendly =
        entity.attributes && entity.attributes.friendly_name
          ? entity.attributes.friendly_name
          : "";

      var text = (entity.entity_id + " " + friendly).toLowerCase();

      for (var j = 0; j < terms.length; j++) {
        if (text.indexOf(terms[j].toLowerCase()) !== -1) {
          result.push(entity);
          break;
        }
      }
    }

    var self = this;

    result.sort(function (a, b) {
      return self._friendly(a.entity_id).localeCompare(self._friendly(b.entity_id));
    });

    return result;
  }

  _greeting() {
    var hour = new Date().getHours();

    if (hour < 5) {
      return "Good night";
    }

    if (hour < 12) {
      return "Good morning";
    }

    if (hour < 18) {
      return "Good afternoon";
    }

    return "Good evening";
  }

  _date() {
    try {
      return new Intl.DateTimeFormat("en", {
        weekday: "long",
        day: "2-digit",
        month: "long"
      }).format(new Date());
    } catch (err) {
      return new Date().toDateString();
    }
  }

  _chipData() {
    var chips = [];
    var entity;
    var value;

    if (this._state("input_boolean.cpu_temperature_alert") &&
        this._state("input_boolean.cpu_temperature_alert").state === "on") {
      chips.push({
        icon: "mdi:thermometer-alert",
        text: "",
        tone: "red",
        page: "network"
      });
    }

    if (this._state("input_boolean.ups_status") &&
        this._state("input_boolean.ups_status").state === "on") {
      entity = this._state("sensor.powerwalker_battery_charge");
      value = entity ? entity.state : "—";

      chips.push({
        icon: "mdi:car-battery",
        text: value + "%",
        tone: "red",
        page: "network"
      });
    }

    if (this._state("input_boolean.energy_notification") &&
        this._state("input_boolean.energy_notification").state === "on") {
      entity = this._state("sensor.shellyem3_349454756093_channel_a_power");
      value = entity ? parseFloat(entity.state) : NaN;

      chips.push({
        icon: "mdi:home-lightning-bolt-outline",
        text: (isNaN(value) ? "—" : Math.round(value)) + " W",
        tone: "red",
        page: "energy"
      });
    }

    if (this._state("binary_sensor.mi_smart_humidifier_water_tank_empty") &&
        this._state("binary_sensor.mi_smart_humidifier_water_tank_empty").state === "on") {
      chips.push({
        icon: "mdi:water-remove",
        text: "Humidifier empty",
        tone: "red",
        page: "climate"
      });
    }

    if (this._state("input_boolean.heating") &&
        this._state("input_boolean.heating").state === "on") {
      chips.push({
        icon: "mdi:heating-coil",
        text: "",
        tone: "orange",
        page: "climate"
      });
    }

    if (this._state("input_boolean.boiler") &&
        this._state("input_boolean.boiler").state === "on") {
      chips.push({
        icon: "mdi:water-boiler",
        text: "",
        tone: "orange",
        page: "house"
      });
    }

    if (this._state("input_boolean.stove_notification") &&
        this._state("input_boolean.stove_notification").state === "on") {
      chips.push({
        icon: "mdi:stove",
        text: "",
        tone: "orange",
        entity: "sensor.shellyem3_349454756093_channel_b_power"
      });
    }

    entity = this._state("weather.openweathermap");

    if (entity) {
      value =
        entity.attributes && entity.attributes.temperature !== undefined
          ? entity.attributes.temperature
          : "—";

      chips.push({
        icon: "mdi:weather-partly-cloudy",
        text: value + "°",
        tone: "white",
        page: "weather"
      });
    }

    return chips;
  }

  _renderChips() {
    var chips = this._chipData();
    var html = '<div class="chips">';

    for (var i = 0; i < chips.length; i++) {
      var chip = chips[i];
      var actionable = chip.page || chip.entity;

      html +=
        '<button class="chip tone-' +
        chip.tone +
        '" data-chip="' +
        i +
        '" data-focusable="' +
        (actionable ? "true" : "false") +
        '" tabindex="' +
        (actionable ? "0" : "-1") +
        '">' +
        '<ha-icon icon="' +
        chip.icon +
        '"></ha-icon>' +
        (chip.text ? "<span>" + this._escape(chip.text) + "</span>" : "") +
        "</button>";
    }

    html += "</div>";
    return html;
  }

  _renderHeader(title, subtitle) {
    return (
      '<header class="page-header">' +
      '<div class="header-left">' +
      '<button class="back-button" data-action="back" data-focusable="true" tabindex="0">' +
      '<ha-icon icon="mdi:chevron-left"></ha-icon>' +
      "</button>" +
      "<div>" +
      '<div class="page-title">' +
      this._escape(title) +
      "</div>" +
      '<div class="page-subtitle">' +
      this._escape(subtitle || "") +
      "</div>" +
      "</div>" +
      "</div>" +
      '<div class="clock">' +
      new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) +
      "</div>" +
      "</header>"
    );
  }

  _renderHome() {
    var menu = [
      ["House", "Devices & modes", "mdi:home-outline", "house"],
      ["Lights", "Lighting", "mdi:lamps", "lights"],
      ["Security", "Alarm & sensors", "mdi:shield-home-outline", "security"],
      ["Media", "Music & players", "mdi:music", "media"],
      ["Climate", "Temperature & air", "mdi:home-thermometer-outline", "climate"],
      ["Vacuum", "Roborock Q Revo", "mdi:robot-vacuum", "vacuum"],
      ["Plants", "Watering & sensors", "mdi:flower-outline", "plants"],
      ["Network", "Server & network", "mdi:server-network-outline", "network"]
    ];

    var people = [
      ["Dimitris", "person.dimitris"],
      ["Vassilis", "person.vassilis"],
      ["Flery", "person.fleri"],
      ["Guest", "person.guest"]
    ];

    var html =
      this._renderChips() +
      '<section class="home-hero">' +
      '<div><div class="eyebrow">TV DASHBOARD</div>' +
      "<h1>" +
      this._escape(this._greeting()) +
      "</h1>" +
      "<p>" +
      this._escape(this._date()) +
      "</p></div>" +
      '<ha-icon icon="mdi:home"></ha-icon>' +
      "</section>" +
      '<section class="menu-grid">';

    for (var i = 0; i < menu.length; i++) {
      html +=
        '<button class="nav-card" data-page="' +
        menu[i][3] +
        '" data-focusable="true" tabindex="0">' +
        '<ha-icon icon="' +
        menu[i][2] +
        '"></ha-icon>' +
        '<div class="nav-title">' +
        menu[i][0] +
        "</div>" +
        '<div class="nav-subtitle">' +
        menu[i][1] +
        "</div>" +
        "</button>";
    }

    html += '</section><section class="people-row">';

    for (var j = 0; j < people.length; j++) {
      entity = this._state(people[j][1]);
      var state = entity ? entity.state : "unknown";

      html +=
        '<button class="person-card ' +
        (state === "home" ? "is-home" : "") +
        '" data-info="' +
        people[j][1] +
        '" data-focusable="true" tabindex="0">' +
        '<div class="presence-dot"></div>' +
        "<div><div class="person-name">" +
        people[j][0] +
        '</div><div class="person-state">' +
        this._escape(state.split("_").join(" ")) +
        "</div></div></button>";
    }

    html += "</section>";
    return html;
  }

  _entityCard(entity, icon, toggleable) {
    var active =
      entity.state === "on" ||
      entity.state === "open" ||
      entity.state === "playing" ||
      entity.state === "heat" ||
      entity.state === "cool";

    return (
      '<button class="control-card ' +
      (active ? "active" : "") +
      '" data-entity="' +
      entity.entity_id +
      '" data-toggle="' +
      (toggleable ? "true" : "false") +
      '" data-focusable="true" tabindex="0">' +
      '<ha-icon icon="' +
      icon +
      '"></ha-icon>' +
      '<div class="item-name">' +
      this._escape(this._friendly(entity.entity_id)) +
      "</div>" +
      '<div class="item-state">' +
      this._escape(entity.state.split("_").join(" ")) +
      "</div>" +
      "</button>"
    );
  }

  _sensorCard(entity) {
    var unit =
      entity.attributes && entity.attributes.unit_of_measurement
        ? entity.attributes.unit_of_measurement
        : "";

    return (
      '<button class="sensor-card" data-info="' +
      entity.entity_id +
      '" data-focusable="true" tabindex="0">' +
      '<div class="sensor-name">' +
      this._escape(this._friendly(entity.entity_id)) +
      "</div>" +
      '<div class="sensor-value">' +
      this._escape(entity.state) +
      (unit ? "<span>" + this._escape(unit) + "</span>" : "") +
      "</div>" +
      "</button>"
    );
  }

  _renderEntityPage(title, subtitle, entities, icon, toggleable) {
    var html = this._renderHeader(title, subtitle) + '<section class="control-grid">';

    if (!entities.length) {
      html += '<div class="empty">No matching entities found</div>';
    }

    for (var i = 0; i < entities.length; i++) {
      html += this._entityCard(entities[i], icon, toggleable);
    }

    html += "</section>";
    return html;
  }

  _renderLights() {
    return this._renderEntityPage(
      "Lights",
      "Lighting",
      this._entities("light"),
      "mdi:lightbulb-outline",
      true
    );
  }

  _renderHouse() {
    var ids = [
      "input_boolean.boiler",
      "input_boolean.dnd",
      "input_boolean.guest",
      "input_boolean.vacation",
      "input_boolean.heating",
      "input_boolean.washing_machine"
    ];

    var entities = [];

    for (var i = 0; i < ids.length; i++) {
      var entity = this._state(ids[i]);
      if (entity) {
        entities.push(entity);
      }
    }

    return this._renderEntityPage(
      "House",
      "Devices & modes",
      entities,
      "mdi:home-outline",
      true
    );
  }

  _renderClimate() {
    var climates = this._entities("climate");
    var sensors = this._matching(
      ["sensor"],
      ["temperature", "humidity", "pm2", "aqi", "air quality"]
    );

    var html = this._renderHeader("Climate", "Temperature & air");

    html += '<section class="control-grid">';

    for (var i = 0; i < climates.length; i++) {
      html += this._entityCard(
        climates[i],
        "mdi:thermostat",
        false
      );
    }

    html += '</section><div class="section-title">Sensors</div><section class="sensor-grid">';

    for (var j = 0; j < sensors.length && j < 16; j++) {
      html += this._sensorCard(sensors[j]);
    }

    html += "</section>";
    return html;
  }

  _renderSecurity() {
    var alarm = this._state("alarm_control_panel.home_alarm");
    var sensors = this._entities("binary_sensor");
    var filtered = [];

    for (var i = 0; i < sensors.length; i++) {
      var dc =
        sensors[i].attributes && sensors[i].attributes.device_class
          ? sensors[i].attributes.device_class
          : "";

      if (
        dc === "door" ||
        dc === "window" ||
        dc === "opening" ||
        dc === "motion" ||
        dc === "occupancy"
      ) {
        filtered.push(sensors[i]);
      }
    }

    var html = this._renderHeader("Security", "Alarm & sensors");

    if (alarm) {
      html +=
        '<button class="hero-state" data-info="' +
        alarm.entity_id +
        '" data-focusable="true" tabindex="0">' +
        '<ha-icon icon="mdi:shield-home-outline"></ha-icon>' +
        '<div><div class="hero-label">Home alarm</div>' +
        '<div class="hero-value">' +
        this._escape(alarm.state.split("_").join(" ")) +
        "</div></div></button>";
    }

    html += '<section class="sensor-grid">';

    for (var j = 0; j < filtered.length; j++) {
      html += this._sensorCard(filtered[j]);
    }

    html += "</section>";
    return html;
  }

  _renderMedia() {
    var players = this._entities("media_player");
    var html = this._renderHeader("Media", "Music & players") + '<section class="media-grid">';

    if (!players.length) {
      html += '<div class="empty">No media players found</div>';
    }

    for (var i = 0; i < players.length; i++) {
      var p = players[i];
      var title =
        p.attributes && p.attributes.media_title
          ? p.attributes.media_title
          : "";

      html +=
        '<div class="media-card">' +
        '<button class="media-main" data-info="' +
        p.entity_id +
        '" data-focusable="true" tabindex="0">' +
        '<ha-icon icon="mdi:speaker"></ha-icon>' +
        "<div><div class="item-name">" +
        this._escape(this._friendly(p.entity_id)) +
        '</div><div class="item-state">' +
        this._escape(p.state) +
        "</div>" +
        (title ? '<div class="media-title">' + this._escape(title) + "</div>" : "") +
        "</div></button>" +
        '<div class="media-actions">' +
        '<button data-media="prev" data-entity="' +
        p.entity_id +
        '" data-focusable="true" tabindex="0"><ha-icon icon="mdi:skip-previous"></ha-icon></button>' +
        '<button data-media="play" data-entity="' +
        p.entity_id +
        '" data-focusable="true" tabindex="0"><ha-icon icon="mdi:play-pause"></ha-icon></button>' +
        '<button data-media="next" data-entity="' +
        p.entity_id +
        '" data-focusable="true" tabindex="0"><ha-icon icon="mdi:skip-next"></ha-icon></button>' +
        '<button data-media="down" data-entity="' +
        p.entity_id +
        '" data-focusable="true" tabindex="0"><ha-icon icon="mdi:volume-minus"></ha-icon></button>' +
        '<button data-media="up" data-entity="' +
        p.entity_id +
        '" data-focusable="true" tabindex="0"><ha-icon icon="mdi:volume-plus"></ha-icon></button>' +
        "</div></div>";
    }

    html += "</section>";
    return html;
  }

  _renderVacuum() {
    var vac = this._state("vacuum.roborock_qrevo");
    if (!vac) {
      var all = this._entities("vacuum");
      vac = all.length ? all[0] : null;
    }

    var html = this._renderHeader("Vacuum", "Roborock");

    if (!vac) {
      return html + '<div class="empty">No vacuum entity found</div>';
    }

    html +=
      '<section class="vacuum-hero">' +
      '<ha-icon icon="mdi:robot-vacuum"></ha-icon>' +
      '<div class="vacuum-state">' +
      this._escape(vac.state.split("_").join(" ")) +
      "</div></section>" +
      '<section class="action-row">' +
      '<button data-vacuum="start" data-entity="' +
      vac.entity_id +
      '" data-focusable="true" tabindex="0">Start</button>' +
      '<button data-vacuum="pause" data-entity="' +
      vac.entity_id +
      '" data-focusable="true" tabindex="0">Pause</button>' +
      '<button data-vacuum="stop" data-entity="' +
      vac.entity_id +
      '" data-focusable="true" tabindex="0">Stop</button>' +
      '<button data-vacuum="dock" data-entity="' +
      vac.entity_id +
      '" data-focusable="true" tabindex="0">Dock</button>' +
      "</section>";

    return html;
  }

  _renderPlants() {
    var entities = this._matching(
      ["sensor", "binary_sensor", "switch", "valve", "input_boolean"],
      ["plant", "soil", "moisture", "watering", "irrigation", "balcony", "garden"]
    );

    var html = this._renderHeader("Plants", "Watering & sensors") + '<section class="sensor-grid">';

    for (var i = 0; i < entities.length && i < 24; i++) {
      html += this._sensorCard(entities[i]);
    }

    html += "</section>";
    return html;
  }

  _renderWeather() {
    var weather = this._state("weather.openweathermap");
    var html = this._renderHeader("Weather", "OpenWeatherMap");

    if (!weather) {
      return html + '<div class="empty">weather.openweathermap not found</div>';
    }

    var temp =
      weather.attributes && weather.attributes.temperature !== undefined
        ? weather.attributes.temperature
        : "—";

    var humidity =
      weather.attributes && weather.attributes.humidity !== undefined
        ? weather.attributes.humidity
        : "—";

    html +=
      '<section class="weather-hero">' +
      '<ha-icon icon="mdi:weather-partly-cloudy"></ha-icon>' +
      "<div><div class="weather-temp">" +
      this._escape(temp) +
      '°</div><div class="weather-condition">' +
      this._escape(weather.state.split("_").join(" ")) +
      "</div></div>" +
      '<div class="weather-meta"><div>Humidity <strong>' +
      this._escape(humidity) +
      "%</strong></div></div></section>";

    return html;
  }

  _renderNetwork() {
    var entities = this._matching(
      ["sensor", "binary_sensor", "update"],
      [
        "network",
        "server",
        "unifi",
        "internet",
        "wan",
        "lan",
        "ping",
        "uptime",
        "cpu",
        "memory",
        "disk",
        "temperature"
      ]
    );

    var html = this._renderHeader("Network", "Server & network") + '<section class="sensor-grid">';

    for (var i = 0; i < entities.length && i < 28; i++) {
      html += this._sensorCard(entities[i]);
    }

    html += "</section>";
    return html;
  }

  _renderEnergy() {
    var entities = [];
    var all = this._entities("sensor");

    for (var i = 0; i < all.length; i++) {
      var dc =
        all[i].attributes && all[i].attributes.device_class
          ? all[i].attributes.device_class
          : "";

      if (dc === "power" || dc === "energy") {
        entities.push(all[i]);
      }
    }

    var html = this._renderHeader("Energy", "Power consumption") + '<section class="sensor-grid">';

    for (var j = 0; j < entities.length && j < 24; j++) {
      html += this._sensorCard(entities[j]);
    }

    html += "</section>";
    return html;
  }

  _styles() {
    return `
      :host {
        position: fixed !important;
        inset: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        min-width: 100vw !important;
        min-height: 100vh !important;
        z-index: 2147483647 !important;
        display: block !important;
        overflow: auto !important;
        background: #000 !important;
        color: #fff;
        font-family: Arial, Helvetica, sans-serif;
      }

      * {
        box-sizing: border-box;
      }

      button {
        font: inherit;
        color: inherit;
        border: 0;
      }

      .shell {
        width: calc(100vw - 72px);
        max-width: 1760px;
        min-height: 100vh;
        margin: 0 auto;
        padding: 30px 0 46px;
        background: #000;
      }

      .chips {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
        min-height: 48px;
        margin-bottom: 22px;
      }

      .chip {
        height: 42px;
        border-radius: 22px;
        padding: 0 14px;
        background: #111;
        border: 1px solid #282828;
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }

      .chip ha-icon {
        --mdc-icon-size: 22px;
      }

      .chip span {
        font-size: 15px;
        font-weight: 600;
      }

      .tone-red ha-icon { color: #ff5a5f; }
      .tone-orange ha-icon { color: #ff9f43; }
      .tone-white ha-icon { color: #fff; }

      .home-hero {
        min-height: 150px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 8px 8px;
      }

      .home-hero h1 {
        margin: 7px 0 5px;
        font-size: 54px;
        line-height: 1;
        letter-spacing: -1.6px;
      }

      .home-hero p {
        margin: 0;
        color: #8c8c8c;
        font-size: 21px;
      }

      .home-hero > ha-icon {
        --mdc-icon-size: 72px;
        color: #242424;
      }

      .eyebrow {
        font-size: 12px;
        letter-spacing: 2px;
        color: #666;
        font-weight: 700;
      }

      .menu-grid,
      .control-grid,
      .sensor-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 16px;
      }

      .nav-card,
      .control-card {
        min-height: 170px;
        border-radius: 24px;
        background: #101010;
        border: 1px solid #242424;
        padding: 24px;
        text-align: left;
      }

      .nav-card ha-icon,
      .control-card ha-icon {
        --mdc-icon-size: 44px;
        color: #e8e8e8;
      }

      .nav-title,
      .item-name {
        margin-top: 28px;
        font-size: 24px;
        font-weight: 650;
      }

      .nav-subtitle,
      .item-state {
        margin-top: 7px;
        color: #777;
        font-size: 15px;
        text-transform: capitalize;
      }

      .control-card.active {
        background: #181818;
        border-color: #555;
      }

      .people-row {
        margin-top: 16px;
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 14px;
      }

      .person-card {
        min-height: 72px;
        border-radius: 20px;
        background: #0c0c0c;
        border: 1px solid #1d1d1d;
        display: flex;
        align-items: center;
        gap: 13px;
        padding: 15px 18px;
        text-align: left;
      }

      .presence-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #555;
      }

      .person-card.is-home .presence-dot {
        background: #52d273;
        box-shadow: 0 0 14px rgba(82,210,115,.45);
      }

      .person-name {
        font-size: 17px;
        font-weight: 650;
      }

      .person-state {
        margin-top: 2px;
        color: #707070;
        font-size: 13px;
        text-transform: capitalize;
      }

      .page-header {
        min-height: 92px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 20px;
      }

      .header-left {
        display: flex;
        align-items: center;
        gap: 18px;
      }

      .back-button {
        width: 54px;
        height: 54px;
        border-radius: 16px;
        background: #0e0e0e;
        border: 1px solid #222;
        display: grid;
        place-items: center;
      }

      .back-button ha-icon {
        --mdc-icon-size: 32px;
      }

      .page-title {
        font-size: 38px;
        font-weight: 700;
        letter-spacing: -1px;
      }

      .page-subtitle {
        margin-top: 4px;
        color: #727272;
        font-size: 16px;
      }

      .clock {
        color: #666;
        font-size: 24px;
      }

      .sensor-card {
        min-height: 120px;
        border-radius: 20px;
        background: #0d0d0d;
        border: 1px solid #202020;
        padding: 19px;
        text-align: left;
      }

      .sensor-name {
        color: #898989;
        font-size: 14px;
      }

      .sensor-value {
        margin-top: 15px;
        font-size: 28px;
        font-weight: 700;
      }

      .sensor-value span {
        margin-left: 4px;
        color: #767676;
        font-size: 15px;
        font-weight: 500;
      }

      .hero-state,
      .weather-hero {
        min-height: 180px;
        border-radius: 28px;
        background: #0d0d0d;
        border: 1px solid #222;
        display: flex;
        align-items: center;
        gap: 26px;
        padding: 30px 34px;
        margin-bottom: 18px;
        text-align: left;
      }

      .hero-state ha-icon,
      .weather-hero ha-icon {
        --mdc-icon-size: 72px;
        color: #ddd;
      }

      .hero-label {
        color: #777;
        font-size: 16px;
      }

      .hero-value {
        margin-top: 4px;
        font-size: 34px;
        font-weight: 700;
        text-transform: capitalize;
      }

      .media-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
      }

      .media-card {
        border-radius: 24px;
        background: #0d0d0d;
        border: 1px solid #202020;
        overflow: hidden;
      }

      .media-main {
        width: 100%;
        min-height: 145px;
        background: transparent;
        display: flex;
        align-items: center;
        gap: 18px;
        padding: 24px;
        text-align: left;
      }

      .media-main ha-icon {
        --mdc-icon-size: 46px;
      }

      .media-title {
        margin-top: 8px;
        color: #b0b0b0;
      }

      .media-actions {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        border-top: 1px solid #1e1e1e;
      }

      .media-actions button {
        height: 56px;
        background: #111;
        border-right: 1px solid #1e1e1e;
      }

      .vacuum-hero {
        min-height: 280px;
        border-radius: 28px;
        background: #0d0d0d;
        border: 1px solid #222;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        margin-bottom: 16px;
      }

      .vacuum-hero ha-icon {
        --mdc-icon-size: 80px;
      }

      .vacuum-state {
        margin-top: 16px;
        font-size: 36px;
        font-weight: 700;
        text-transform: capitalize;
      }

      .action-row {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 14px;
      }

      .action-row button {
        min-height: 88px;
        border-radius: 20px;
        background: #0f0f0f;
        border: 1px solid #222;
        font-weight: 650;
      }

      .weather-hero {
        justify-content: space-between;
      }

      .weather-temp {
        font-size: 62px;
        font-weight: 750;
      }

      .weather-condition {
        color: #777;
        font-size: 18px;
        text-transform: capitalize;
      }

      .weather-meta {
        margin-left: auto;
      }

      .weather-meta div {
        display: flex;
        flex-direction: column;
        gap: 6px;
        color: #666;
      }

      .weather-meta strong {
        color: #fff;
        font-size: 22px;
      }

      .section-title {
        margin: 30px 0 12px;
        color: #777;
        font-size: 15px;
        font-weight: 650;
        text-transform: uppercase;
        letter-spacing: 1px;
      }

      .empty {
        grid-column: 1 / -1;
        min-height: 160px;
        border: 1px dashed #242424;
        border-radius: 20px;
        display: grid;
        place-items: center;
        color: #666;
      }

      [data-focusable="true"] {
        cursor: pointer;
        transition: transform .12s ease, border-color .12s ease, box-shadow .12s ease;
      }

      [data-focusable="true"].focused {
        outline: none;
        transform: scale(1.035);
        border-color: #fff !important;
        box-shadow: 0 0 0 3px #fff;
        z-index: 10;
      }

      [data-focusable="true"]:focus {
        outline: none;
      }

      .version {
        margin-top: 24px;
        text-align: right;
        color: #333;
        font-size: 12px;
      }

      @media (max-width: 1200px) {
        .shell {
          width: calc(100vw - 40px);
        }

        .menu-grid,
        .control-grid,
        .sensor-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .people-row {
          grid-template-columns: repeat(2, 1fr);
        }
      }
    `;
  }

  _wireEvents() {
    var self = this;
    var nodes;
    var i;

    nodes = this.shadowRoot.querySelectorAll("[data-page]");
    for (i = 0; i < nodes.length; i++) {
      (function (el) {
        el.addEventListener("click", function () {
          self._go(el.getAttribute("data-page"));
        });
      })(nodes[i]);
    }

    nodes = this.shadowRoot.querySelectorAll('[data-action="back"]');
    for (i = 0; i < nodes.length; i++) {
      nodes[i].addEventListener("click", function () {
        self._go("home");
      });
    }

    nodes = this.shadowRoot.querySelectorAll("[data-info]");
    for (i = 0; i < nodes.length; i++) {
      (function (el) {
        el.addEventListener("click", function () {
          self._showMoreInfo(el.getAttribute("data-info"));
        });
      })(nodes[i]);
    }

    nodes = this.shadowRoot.querySelectorAll('[data-toggle="true"]');
    for (i = 0; i < nodes.length; i++) {
      (function (el) {
        el.addEventListener("click", function () {
          self._toggle(el.getAttribute("data-entity"));
        });
      })(nodes[i]);
    }

    var chips = this._chipData();
    nodes = this.shadowRoot.querySelectorAll("[data-chip]");

    for (i = 0; i < nodes.length; i++) {
      (function (el) {
        var index = parseInt(el.getAttribute("data-chip"), 10);
        var chip = chips[index];

        if (!chip) {
          return;
        }

        if (chip.page) {
          el.addEventListener("click", function () {
            self._go(chip.page);
          });
        } else if (chip.entity) {
          el.addEventListener("click", function () {
            self._showMoreInfo(chip.entity);
          });
        }
      })(nodes[i]);
    }

    nodes = this.shadowRoot.querySelectorAll("[data-media]");
    for (i = 0; i < nodes.length; i++) {
      (function (el) {
        el.addEventListener("click", function () {
          var action = el.getAttribute("data-media");
          var id = el.getAttribute("data-entity");

          if (action === "play") {
            self._call("media_player", "media_play_pause", { entity_id: id });
          } else if (action === "prev") {
            self._call("media_player", "media_previous_track", { entity_id: id });
          } else if (action === "next") {
            self._call("media_player", "media_next_track", { entity_id: id });
          } else if (action === "down") {
            self._call("media_player", "volume_down", { entity_id: id });
          } else if (action === "up") {
            self._call("media_player", "volume_up", { entity_id: id });
          }
        });
      })(nodes[i]);
    }

    nodes = this.shadowRoot.querySelectorAll("[data-vacuum]");
    for (i = 0; i < nodes.length; i++) {
      (function (el) {
        el.addEventListener("click", function () {
          var action = el.getAttribute("data-vacuum");
          var id = el.getAttribute("data-entity");

          if (action === "start") {
            self._call("vacuum", "start", { entity_id: id });
          } else if (action === "pause") {
            self._call("vacuum", "pause", { entity_id: id });
          } else if (action === "stop") {
            self._call("vacuum", "stop", { entity_id: id });
          } else if (action === "dock") {
            self._call("vacuum", "return_to_base", { entity_id: id });
          }
        });
      })(nodes[i]);
    }
  }

  _render() {
    if (!this.shadowRoot || !this._hass) {
      return;
    }

    var page = this._page();
    var content;

    if (page === "lights") {
      content = this._renderLights();
    } else if (page === "house") {
      content = this._renderHouse();
    } else if (page === "security") {
      content = this._renderSecurity();
    } else if (page === "media") {
      content = this._renderMedia();
    } else if (page === "climate") {
      content = this._renderClimate();
    } else if (page === "vacuum") {
      content = this._renderVacuum();
    } else if (page === "plants") {
      content = this._renderPlants();
    } else if (page === "weather") {
      content = this._renderWeather();
    } else if (page === "network") {
      content = this._renderNetwork();
    } else if (page === "energy") {
      content = this._renderEnergy();
    } else {
      content = this._renderHome();
    }

    this.shadowRoot.innerHTML =
      "<style>" +
      this._styles() +
      "</style>" +
      '<main class="shell">' +
      content +
      '<div class="version">TV Dashboard v' +
      TV_DASHBOARD_VERSION +
      "</div></main>";

    this._wireEvents();

    var self = this;
    window.requestAnimationFrame(function () {
      self._ensureFocus();
    });
  }
}

if (!customElements.get("tv-dashboard-panel")) {
  customElements.define("tv-dashboard-panel", TvDashboardPanel);
}

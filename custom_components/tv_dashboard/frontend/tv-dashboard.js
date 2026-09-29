const VERSION = "0.1.0";

class TvDashboardPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._focusIndex = 0;
    this._onKeyDownBound = this._onKeyDown.bind(this);
  }

  set hass(value) {
    this._hass = value;
    this.render();
  }

  get hass() {
    return this._hass;
  }

  set panel(value) {
    this._panel = value;
  }

  connectedCallback() {
    window.addEventListener("keydown", this._onKeyDownBound, true);
    this._timer = window.setInterval(() => this.render(), 60000);
    this.render();
  }

  disconnectedCallback() {
    window.removeEventListener("keydown", this._onKeyDownBound, true);
    if (this._timer) window.clearInterval(this._timer);
  }

  _state(id) {
    if (!this._hass || !this._hass.states) return undefined;
    return this._hass.states[id];
  }

  _is(id, state) {
    const entity = this._state(id);
    return entity && entity.state === state;
  }

  _navigate(path) {
    history.pushState(null, "", path);
    window.dispatchEvent(new CustomEvent("location-changed"));
  }

  _showMoreInfo(entityId) {
    this.dispatchEvent(new CustomEvent("hass-more-info", {
      detail: { entityId },
      bubbles: true,
      composed: true,
    }));
  }

  _focusables() {
    return [...this.shadowRoot.querySelectorAll("[data-focusable='true']")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
  }

  _setFocused(el) {
    const items = this._focusables();
    items.forEach((x) => x.classList.remove("focused"));
    if (!el) return;
    el.classList.add("focused");
    el.focus({ preventScroll: true });
    const i = items.indexOf(el);
    if (i >= 0) this._focusIndex = i;
  }

  _ensureFocus() {
    const items = this._focusables();
    if (!items.length) return;
    const current = items.find((x) => x.classList.contains("focused"));
    if (!current) this._setFocused(items[Math.min(this._focusIndex, items.length - 1)]);
  }

  _move(direction) {
    const items = this._focusables();
    if (!items.length) return;

    let current = items.find((x) => x.classList.contains("focused"));
    if (!current) {
      this._setFocused(items[0]);
      return;
    }

    const a = current.getBoundingClientRect();
    const ax = a.left + a.width / 2;
    const ay = a.top + a.height / 2;

    let best = null;
    let score = Infinity;

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
      const candidateScore = primary + secondary * 2.4;
      if (candidateScore < score) {
        score = candidateScore;
        best = candidate;
      }
    }

    if (best) this._setFocused(best);
  }

  _onKeyDown(event) {
    const key = event.key;
    const code = event.keyCode;

    if (key === "ArrowLeft" || code === 37) {
      event.preventDefault(); event.stopPropagation(); this._move("left"); return;
    }
    if (key === "ArrowRight" || code === 39) {
      event.preventDefault(); event.stopPropagation(); this._move("right"); return;
    }
    if (key === "ArrowUp" || code === 38) {
      event.preventDefault(); event.stopPropagation(); this._move("up"); return;
    }
    if (key === "ArrowDown" || code === 40) {
      event.preventDefault(); event.stopPropagation(); this._move("down"); return;
    }
    if (key === "Enter" || key === " " || code === 13) {
      const focused = this._focusables().find((x) => x.classList.contains("focused"));
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
      history.back();
    }
  }

  _greeting() {
    const h = new Date().getHours();
    if (h < 5) return "Good night";
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  }

  _date() {
    return new Intl.DateTimeFormat("en", {
      weekday: "long",
      day: "2-digit",
      month: "long",
    }).format(new Date());
  }

  _weather() {
    const weather = this._state("weather.openweathermap");
    const temp = weather && weather.attributes ? weather.attributes.temperature : undefined;
    const state = weather ? weather.state : "unknown";
    return {
      temp: temp === undefined ? "—" : temp + " °C",
      condition: state.split("_").join(" ").replace(/\b\w/g, function (m) {
        return m.toUpperCase();
      }),
    };
  }

  _alerts() {
    const items = [];

    if (this._is("input_boolean.cpu_temperature_alert", "on")) {
      items.push(["Server temperature alert", "Check server room", "mdi:thermometer-alert", "red", () => this._navigate("/new-minimalist/server_room")]);
    }

    if (this._is("input_boolean.ups_status", "on")) {
      const s = this._state("sensor.powerwalker_battery_charge");
      items.push(["UPS", "Battery " + (s ? s.state : "—") + "%", "mdi:battery-alert", "red", () => this._navigate("/new-minimalist/ups")]);
    }

    if (this._is("input_boolean.energy_notification", "on")) {
      const s = this._state("sensor.shellyem3_349454756093_channel_a_power");
      const n = s ? Number(s.state) : NaN;
      items.push(["High power usage", (Number.isFinite(n) ? Math.round(n) : "—") + " W", "mdi:home-lightning-bolt", "red", () => this._navigate("/new-minimalist/energy")]);
    }

    if (this._is("binary_sensor.mi_smart_humidifier_water_tank_empty", "on")) {
      items.push(["Humidifier", "Water tank empty", "mdi:water-remove", "red", () => this._navigate("/new-minimalist/clima")]);
    }

    if (this._is("input_boolean.stove_notification", "on")) {
      items.push(["Stove", "Still active", "mdi:stove", "orange", () => this._showMoreInfo("sensor.shellyem3_349454756093_channel_b_power")]);
    }

    if (this._is("input_boolean.boiler", "on")) {
      items.push(["Boiler", "Running", "mdi:water-boiler", "orange", () => this._navigate("/new-minimalist/house")]);
    }

    if (this._is("input_boolean.washing_machine", "on")) {
      items.push(["Washing machine", "Finished", "mdi:washing-machine", "orange", null]);
    }

    if (this._is("input_boolean.heating", "on")) {
      items.push(["Heating", "Active", "mdi:heating-coil", "orange", () => this._navigate("/new-minimalist/clima")]);
    }

    const dock = this._state("sensor.roborock_qrevo_dock_error");
    const vac = this._state("sensor.roborock_qrevo_vacuum_error");
    const dockState = dock ? dock.state : undefined;
    const vacState = vac ? vac.state : undefined;
    const ok = ["none", "Ok", "OK", "unknown", "unavailable"];

    if (dockState === "Error" || (vacState && !ok.includes(vacState))) {
      items.push(["Roborock", "Error", "mdi:robot-vacuum-alert", "red", () => this._navigate("/new-minimalist/vacuum")]);
    }

    return items;
  }

  _menu() {
    return [
      ["Home", "Devices & controls", "mdi:home", "blue", "/new-minimalist/house"],
      ["Lights", "Lighting", "mdi:lamps", "amber", "/new-minimalist/lights"],
      ["Climate", "Temperature & air", "mdi:home-thermometer-outline", "deep-orange", "/new-minimalist/clima"],
      ["Security", "Alarm & sensors", "mdi:shield-home", "red", "/new-minimalist/security"],
      ["Media", "Music & audio", "mdi:music", "cyan", "/new-minimalist/media"],
      ["Vacuum", "Roborock Q Revo", "mdi:robot-vacuum", "teal", "/new-minimalist/vacuum"],
      ["Plants", "Watering & sensors", "mdi:flower", "green", "/new-minimalist/plants"],
      ["Weather", "Forecast", "mdi:weather-partly-lightning", "purple", "/new-minimalist/weather"],
      ["Network", "Server & network", "mdi:server-network", "cyan", "/new-minimalist/network_lab"],
      ["Energy", "Power consumption", "mdi:lightning-bolt", "yellow", "/new-minimalist/energy"],
    ];
  }

  _people() {
    return [
      ["Dimitris", "person.dimitris", "mdi:account", "/new-minimalist/dimitris_smartphone"],
      ["Vassilis", "person.vassilis", "mdi:account", "/new-minimalist/vassilis_smartphone"],
      ["Flery", "person.fleri", "mdi:dog", "/new-minimalist/fleury"],
      ["Guest", "person.guest", "mdi:account-clock", null],
    ];
  }

  render() {
    if (!this.shadowRoot || !this._hass) return;

    const weather = this._weather();
    const alerts = this._alerts();
    const menu = this._menu();
    const people = this._people();

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display:block;
          min-height:100vh;
          background:var(--primary-background-color);
          color:var(--primary-text-color);
          font-family:Roboto,Arial,sans-serif;
        }
        *{box-sizing:border-box}
        button{font:inherit;color:inherit;border:0;cursor:pointer}
        .page{width:min(1760px,calc(100vw - 72px));margin:0 auto;padding:34px 0 46px}
        .top{display:grid;grid-template-columns:2fr 1fr;gap:22px}
        .card{background:var(--ha-card-background,var(--card-background-color));border:1px solid var(--divider-color)}
        .status,.weather{min-height:112px;border-radius:26px;padding:20px 26px;display:flex;align-items:center;gap:20px}
        .status ha-icon,.weather ha-icon{--mdc-icon-size:54px}
        .headline{display:flex;flex-direction:column}
        .headline .primary{font-size:30px;font-weight:650}
        .headline .secondary{margin-top:7px;font-size:19px;color:var(--secondary-text-color)}
        .alerts,.menu,.people{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px}
        .alerts{margin-top:22px}
        .menu{margin-top:26px}
        .people{margin-top:22px}
        .alert{min-height:94px;border-radius:22px;padding:16px 20px;display:flex;align-items:center;gap:16px;text-align:left}
        .alert ha-icon{--mdc-icon-size:42px}
        .copy{display:flex;flex-direction:column}
        .copy .title{font-size:20px;font-weight:650}
        .copy .subtitle{margin-top:4px;font-size:16px;color:var(--secondary-text-color)}
        .menu-card{min-height:186px;border-radius:30px;padding:24px 16px 20px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;transition:transform .12s ease,box-shadow .12s ease}
        .menu-card ha-icon{--mdc-icon-size:66px}
        .menu-title{margin-top:15px;font-size:26px;font-weight:650}
        .menu-subtitle{margin-top:8px;color:var(--secondary-text-color);font-size:17px}
        .person{min-height:86px;border-radius:22px;padding:14px 18px;display:flex;align-items:center;gap:15px;text-align:left}
        .person ha-icon{--mdc-icon-size:40px}
        .person-copy{display:flex;flex-direction:column}
        .person-name{font-size:19px;font-weight:650}
        .person-state{margin-top:4px;font-size:15px;color:var(--secondary-text-color);text-transform:capitalize}
        [data-focusable="true"].focused{outline:4px solid var(--primary-color);outline-offset:4px;transform:scale(1.035);box-shadow:0 0 0 7px rgba(3,169,244,.24);z-index:5}
        [data-focusable="true"]:focus{outline:none}
        .tone-red ha-icon{color:#ef5350}
        .tone-orange ha-icon{color:#ff9800}
        .tone-blue ha-icon{color:#42a5f5}
        .tone-amber ha-icon{color:#ffc107}
        .tone-deep-orange ha-icon{color:#ff7043}
        .tone-cyan ha-icon{color:#26c6da}
        .tone-teal ha-icon{color:#26a69a}
        .tone-green ha-icon{color:#66bb6a}
        .tone-purple ha-icon{color:#ab47bc}
        .tone-yellow ha-icon{color:#fdd835}
        .tone-grey ha-icon{color:#9e9e9e}
        .version{margin-top:22px;text-align:right;color:var(--secondary-text-color);opacity:.55;font-size:12px}
        @media(max-width:1100px){.page{width:calc(100vw - 34px)}.top{grid-template-columns:1fr}.alerts,.menu,.people{grid-template-columns:repeat(2,minmax(0,1fr))}}
      </style>

      <main class="page">
        <section class="top">
          <div class="status card">
            <ha-icon icon="mdi:home"></ha-icon>
            <div class="headline">
              <span class="primary">${this._greeting()}</span>
              <span class="secondary">${this._date()}</span>
            </div>
          </div>

          <button class="weather card tone-blue" data-focusable="true" data-action="weather" tabindex="0">
            <ha-icon icon="mdi:weather-partly-cloudy"></ha-icon>
            <div class="headline">
              <span class="primary">${weather.temp}</span>
              <span class="secondary">${weather.condition}</span>
            </div>
          </button>
        </section>

        ${alerts.length ? `
          <section class="alerts">
            ${alerts.map((a,i) => `
              <button class="alert card tone-${a[3]}" data-alert="${i}" data-focusable="${a[4] ? "true" : "false"}" tabindex="${a[4] ? "0" : "-1"}">
                <ha-icon icon="${a[2]}"></ha-icon>
                <span class="copy">
                  <span class="title">${a[0]}</span>
                  <span class="subtitle">${a[1]}</span>
                </span>
              </button>
            `).join("")}
          </section>` : ""}

        <section class="menu">
          ${menu.map((m,i) => `
            <button class="menu-card card tone-${m[3]}" data-menu="${i}" data-focusable="true" tabindex="0">
              <ha-icon icon="${m[2]}"></ha-icon>
              <span class="menu-title">${m[0]}</span>
              <span class="menu-subtitle">${m[1]}</span>
            </button>
          `).join("")}
        </section>

        <section class="people">
          ${people.map((p,i) => {
            const s = this._state(p[1]);
            const state = s ? s.state : "unknown";
            const home = state === "home";
            const tone = p[0] === "Guest" && home ? "blue" : home ? "green" : "grey";
            return `
              <button class="person card tone-${tone}" data-person="${i}" data-focusable="${p[3] ? "true" : "false"}" tabindex="${p[3] ? "0" : "-1"}">
                <ha-icon icon="${p[2]}"></ha-icon>
                <span class="person-copy">
                  <span class="person-name">${p[0]}</span>
                  <span class="person-state">${state.split("_").join(" ")}</span>
                </span>
              </button>
            `;
          }).join("")}
        </section>

        <div class="version">TV Dashboard v${VERSION}</div>
      </main>
    `;

    const weatherButton = this.shadowRoot.querySelector('[data-action="weather"]');
    if (weatherButton) weatherButton.addEventListener("click", () => this._navigate("/new-minimalist/weather"));

    this.shadowRoot.querySelectorAll("[data-alert]").forEach((el) => {
      const a = alerts[Number(el.dataset.alert)];
      if (a && a[4]) el.addEventListener("click", a[4]);
    });

    this.shadowRoot.querySelectorAll("[data-menu]").forEach((el) => {
      const m = menu[Number(el.dataset.menu)];
      if (m) el.addEventListener("click", () => this._navigate(m[4]));
    });

    this.shadowRoot.querySelectorAll("[data-person]").forEach((el) => {
      const p = people[Number(el.dataset.person)];
      if (p && p[3]) el.addEventListener("click", () => this._navigate(p[3]));
    });

    requestAnimationFrame(() => this._ensureFocus());
  }
}

if (!customElements.get("tv-dashboard-panel")) {
  customElements.define("tv-dashboard-panel", TvDashboardPanel);
}

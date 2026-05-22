/* ============================================================
   Everyweather forecast fetcher
   ============================================================

   Fetches today's forecast from three independent sources and
   renders them in any element with id="forecasts" on the page.

   Sources:
     - NWS (US National Weather Service)         api.weather.gov
     - Open-Meteo (ECMWF model)                  api.open-meteo.com
     - MET Norway (Norwegian Meteorological)     api.met.no

   All three are free public-good APIs.

   Caching: results are cached in localStorage for 1 hour to
   avoid hammering the APIs on repeat page loads.

   Failure mode: if any source fails, that row shows "—" rather
   than breaking the whole block.
   ============================================================ */

(function() {
  'use strict';

  const container = document.getElementById('forecasts');
  if (!container) return; // No forecast container on this page; do nothing.

  // Location: West River watershed, Townshend, Vermont
  const LAT = 43.0531;
  const LON = -72.6695;

  // Cache helpers ------------------------------------------------

  const CACHE_KEY = 'everyweather_forecasts_v1';
  const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

  function todayKey() {
    const d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  function readCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed.day !== todayKey()) return null;
      if (Date.now() - parsed.fetchedAt > CACHE_TTL_MS) return null;
      return parsed.data;
    } catch (e) {
      return null;
    }
  }

  function writeCache(data) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        day: todayKey(),
        fetchedAt: Date.now(),
        data: data
      }));
    } catch (e) {
      // localStorage failures are non-fatal
    }
  }

  // Source 1: NWS ------------------------------------------------

  async function fetchNWS() {
    try {
      // Two-step API: first get the grid point, then the forecast URL.
      const pointResp = await fetch(`https://api.weather.gov/points/${LAT},${LON}`);
      if (!pointResp.ok) throw new Error('NWS point lookup failed');
      const pointData = await pointResp.json();
      const forecastUrl = pointData.properties && pointData.properties.forecast;
      if (!forecastUrl) throw new Error('NWS forecast URL missing');

      const fcResp = await fetch(forecastUrl);
      if (!fcResp.ok) throw new Error('NWS forecast fetch failed');
      const fcData = await fcResp.json();

      const today = (fcData.properties && fcData.properties.periods && fcData.properties.periods[0]) || null;
      if (!today) throw new Error('NWS no periods');

      return {
        source: 'NWS',
        temp: today.temperature,
        unit: today.temperatureUnit || 'F',
        conditions: today.shortForecast || '',
        period: today.name || 'today'
      };
    } catch (e) {
      return { source: 'NWS', error: true };
    }
  }

  // Source 2: Open-Meteo (uses ECMWF model) ----------------------

  async function fetchOpenMeteo() {
    try {
      const params = new URLSearchParams({
        latitude: LAT,
        longitude: LON,
        daily: 'temperature_2m_max,temperature_2m_min,weathercode',
        temperature_unit: 'fahrenheit',
        timezone: 'America/New_York',
        forecast_days: 1,
        models: 'ecmwf_ifs025'
      });
      const resp = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
      if (!resp.ok) throw new Error('Open-Meteo fetch failed');
      const data = await resp.json();

      const tempMax = data.daily && data.daily.temperature_2m_max && data.daily.temperature_2m_max[0];
      const code = data.daily && data.daily.weathercode && data.daily.weathercode[0];

      if (tempMax === null || tempMax === undefined) throw new Error('Open-Meteo no temp');

      return {
        source: 'ECMWF',
        temp: Math.round(tempMax),
        unit: 'F',
        conditions: weatherCodeToText(code),
        period: 'today'
      };
    } catch (e) {
      return { source: 'ECMWF', error: true };
    }
  }

  // Source 3: MET Norway -----------------------------------------

  async function fetchMETNorway() {
    try {
      const resp = await fetch(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${LAT}&lon=${LON}`, {
        headers: {
          // MET Norway requires a User-Agent identifying the app.
          // Browsers won't let us set User-Agent directly, but they handle this acceptably.
        }
      });
      if (!resp.ok) throw new Error('MET Norway fetch failed');
      const data = await resp.json();

      const timeseries = data.properties && data.properties.timeseries;
      if (!timeseries || !timeseries.length) throw new Error('MET Norway no data');

      // Find the daily max temperature from today's hourly forecasts.
      const today = new Date();
      const todayStr = today.toISOString().slice(0, 10);
      let maxTempC = -Infinity;
      let symbol = null;

      for (const entry of timeseries) {
        if (!entry.time.startsWith(todayStr)) continue;
        const tempC = entry.data && entry.data.instant && entry.data.instant.details && entry.data.instant.details.air_temperature;
        if (typeof tempC === 'number' && tempC > maxTempC) {
          maxTempC = tempC;
        }
        // Try to grab the next_6_hours symbol from a morning forecast as the day's character
        if (!symbol && entry.data && entry.data.next_6_hours && entry.data.next_6_hours.summary) {
          symbol = entry.data.next_6_hours.summary.symbol_code;
        }
      }

      if (maxTempC === -Infinity) throw new Error('MET Norway no temp data for today');

      const tempF = Math.round((maxTempC * 9 / 5) + 32);

      return {
        source: 'MET Norway',
        temp: tempF,
        unit: 'F',
        conditions: metSymbolToText(symbol),
        period: 'today'
      };
    } catch (e) {
      return { source: 'MET Norway', error: true };
    }
  }

  // Open-Meteo WMO weather code → text ---------------------------

  function weatherCodeToText(code) {
    if (code === null || code === undefined) return '';
    // WMO Weather interpretation codes (simplified)
    const codes = {
      0: 'clear',
      1: 'mostly clear',
      2: 'partly cloudy',
      3: 'overcast',
      45: 'fog',
      48: 'rime fog',
      51: 'light drizzle',
      53: 'drizzle',
      55: 'heavy drizzle',
      61: 'light rain',
      63: 'rain',
      65: 'heavy rain',
      71: 'light snow',
      73: 'snow',
      75: 'heavy snow',
      77: 'snow grains',
      80: 'rain showers',
      81: 'heavy rain showers',
      82: 'violent rain',
      85: 'snow showers',
      86: 'heavy snow showers',
      95: 'thunderstorms',
      96: 'thunderstorms with hail',
      99: 'thunderstorms with heavy hail'
    };
    return codes[code] || '';
  }

  // MET Norway symbol code → text --------------------------------

  function metSymbolToText(symbol) {
    if (!symbol) return '';
    // Strip suffixes like _day, _night
    const base = symbol.replace(/_day$|_night$|_polartwilight$/, '');
    const map = {
      'clearsky': 'clear',
      'fair': 'fair',
      'partlycloudy': 'partly cloudy',
      'cloudy': 'cloudy',
      'fog': 'fog',
      'lightrain': 'light rain',
      'rain': 'rain',
      'heavyrain': 'heavy rain',
      'lightrainshowers': 'light rain showers',
      'rainshowers': 'rain showers',
      'heavyrainshowers': 'heavy rain showers',
      'lightsnow': 'light snow',
      'snow': 'snow',
      'heavysnow': 'heavy snow',
      'lightsnowshowers': 'light snow showers',
      'snowshowers': 'snow showers',
      'heavysnowshowers': 'heavy snow showers',
      'sleet': 'sleet',
      'lightsleet': 'light sleet',
      'heavysleet': 'heavy sleet',
      'rainandthunder': 'rain and thunder',
      'snowandthunder': 'snow and thunder'
    };
    return map[base] || base.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  }

  // Render -------------------------------------------------------

  function renderForecasts(results) {
    const rows = results.map(r => {
      if (r.error) {
        return `
          <div class="forecast-source-row">
            <span class="forecast-source-name">${r.source}</span>
            <span class="forecast-source-value forecast-source-error">—</span>
          </div>
        `;
      }
      return `
        <div class="forecast-source-row">
          <span class="forecast-source-name">${r.source}</span>
          <span class="forecast-source-value">
            <span class="forecast-source-temp">${r.temp}°${r.unit}</span>
            ${r.conditions ? `<span class="forecast-source-conditions">· ${r.conditions}</span>` : ''}
          </span>
        </div>
      `;
    }).join('');

    // Invitation link: on the porch, link to the composer; elsewhere, link to the porch.
    const onPorch = window.location.pathname === '/scribe/' || window.location.pathname === '/scribe';
    const invitationHref = onPorch ? '/admin/#/collections/entries/new' : '/scribe/';

    container.innerHTML = `
      <div class="forecasts-block">
        <div class="forecasts-label">Forecasts for Townshend today</div>
        <div class="forecasts-grid">
          ${rows}
        </div>
        <div class="forecasts-invitation">
          <a href="${invitationHref}" class="forecasts-invitation-link">…and yours <span class="arrow">→</span></a>
        </div>
      </div>
    `;
  }

  // Initial loading state ----------------------------------------

  container.innerHTML = `
    <div class="forecasts-block forecasts-loading">
      <div class="forecasts-label">Forecasts for Townshend today</div>
      <div class="forecasts-grid">
        <div class="forecast-source-row"><span class="forecast-source-name">NWS</span><span class="forecast-source-value">…</span></div>
        <div class="forecast-source-row"><span class="forecast-source-name">ECMWF</span><span class="forecast-source-value">…</span></div>
        <div class="forecast-source-row"><span class="forecast-source-name">MET Norway</span><span class="forecast-source-value">…</span></div>
      </div>
    </div>
  `;

  // Run ----------------------------------------------------------

  async function run() {
    const cached = readCache();
    if (cached) {
      renderForecasts(cached);
      return;
    }
    const results = await Promise.all([
      fetchNWS(),
      fetchOpenMeteo(),
      fetchMETNorway()
    ]);
    writeCache(results);
    renderForecasts(results);
  }

  run();

})();

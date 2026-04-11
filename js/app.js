// Main application logic
const state = {
  trackPoints: null,        // full trackpoints
  trackCumDist: null,       // cumulative distance array (m)
  trackLine: null,          // Leaflet polyline
  pois: [],                 // all POIs from last search
  enabledCategories: new Set(Object.keys(CATEGORIES)),
  markersGroup: null,       // Leaflet layer group for POI markers
};

// ---------- Map setup ----------
const map = L.map("map").setView([46.6, 2.5], 6); // France center by default
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);
state.markersGroup = L.layerGroup().addTo(map);

// ---------- DOM refs ----------
const $ = (id) => document.getElementById(id);
const fileInput = $("gpx-input");
const fileDrop = $("file-drop");
const trackInfo = $("track-info");
const radiusInput = $("radius");
const radiusValue = $("radius-value");
const searchBtn = $("search-btn");
const statusEl = $("status");
const resultsPanel = $("results-panel");
const resultsCount = $("results-count");
const resultsList = $("results-list");
const categoriesList = $("categories-list");

// ---------- Categories UI ----------
function renderCategories() {
  categoriesList.innerHTML = "";
  for (const [key, cat] of Object.entries(CATEGORIES)) {
    const wrapper = document.createElement("label");
    wrapper.className = "category-item";
    const count = state.pois.filter((p) => p.category === key).length;
    wrapper.innerHTML = `
      <input type="checkbox" ${state.enabledCategories.has(key) ? "checked" : ""} data-cat="${key}" />
      <span class="category-dot" style="background:${cat.color}">${cat.icon}</span>
      <span class="category-label">${t(cat.labelKey)}</span>
      <span class="category-count">${count || ""}</span>
    `;
    wrapper.querySelector("input").addEventListener("change", (e) => {
      if (e.target.checked) state.enabledCategories.add(key);
      else state.enabledCategories.delete(key);
      renderMarkers();
      renderResultsList();
    });
    categoriesList.appendChild(wrapper);
  }
}

// ---------- Language switcher ----------
document.querySelectorAll(".lang-switcher button").forEach((btn) => {
  btn.addEventListener("click", () => setLang(btn.dataset.lang));
});
window.onLangChange = () => {
  renderCategories();
  renderResultsList();
  updateTrackInfo();
};

// ---------- GPX upload ----------
fileDrop.addEventListener("click", () => fileInput.click());
fileDrop.addEventListener("dragover", (e) => {
  e.preventDefault();
  fileDrop.classList.add("drag-over");
});
fileDrop.addEventListener("dragleave", () => fileDrop.classList.remove("drag-over"));
fileDrop.addEventListener("drop", (e) => {
  e.preventDefault();
  fileDrop.classList.remove("drag-over");
  if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener("change", (e) => {
  if (e.target.files.length) handleFile(e.target.files[0]);
});

async function handleFile(file) {
  try {
    const text = await file.text();
    const points = parseGpx(text);
    state.trackPoints = points;
    state.trackCumDist = cumulativeDistances(points);

    // Display track on map
    if (state.trackLine) map.removeLayer(state.trackLine);
    state.trackLine = L.polyline(
      points.map((p) => [p.lat, p.lon]),
      { color: "#0b7a3e", weight: 4, opacity: 0.85 }
    ).addTo(map);
    map.fitBounds(state.trackLine.getBounds(), { padding: [30, 30] });

    // Clear previous results
    state.pois = [];
    state.markersGroup.clearLayers();
    resultsPanel.hidden = true;
    resultsCount.textContent = "0";
    resultsList.innerHTML = "";

    searchBtn.disabled = false;
    updateTrackInfo();
    statusEl.textContent = "";
    statusEl.className = "status";
  } catch (err) {
    statusEl.textContent = t("parseError") + " (" + err.message + ")";
    statusEl.className = "status error";
  }
}

function updateTrackInfo() {
  if (!state.trackPoints) {
    trackInfo.innerHTML = "";
    return;
  }
  const lengthKm = trackLengthKm(state.trackPoints);
  trackInfo.innerHTML = `<strong>${t("trackLoaded")}</strong> — ${state.trackPoints.length} ${t(
    "points"
  )} • ${lengthKm.toFixed(1)} ${t("km")}`;
}

// ---------- Radius slider ----------
radiusInput.addEventListener("input", () => {
  radiusValue.textContent = `${radiusInput.value} km`;
});

// ---------- Search ----------
searchBtn.addEventListener("click", runSearch);

async function runSearch() {
  if (!state.trackPoints) return;
  if (state.enabledCategories.size === 0) {
    statusEl.textContent = t("selectOne");
    statusEl.className = "status error";
    return;
  }

  searchBtn.disabled = true;
  statusEl.textContent = t("searching");
  statusEl.className = "status loading";

  try {
    const radiusMeters = parseInt(radiusInput.value, 10) * 1000;
    // Simplify the track to keep the query small; use a step proportional to
    // the radius (smaller radius → denser sampling so we don't miss POIs).
    const step = Math.max(200, Math.min(800, radiusMeters / 2));
    const simplified = simplifyByDistance(state.trackPoints, step);

    const query = buildOverpassQuery(
      simplified,
      radiusMeters,
      Array.from(state.enabledCategories)
    );
    const data = await runOverpassQuery(query);
    const pois = normalizeElements(data.elements || []);

    // Compute distance to track + cumulative km for each POI
    for (const poi of pois) {
      const { distanceToTrack, cumulativeKm } = nearestOnTrack(
        poi,
        state.trackPoints,
        state.trackCumDist
      );
      poi.distanceToTrack = distanceToTrack;
      poi.distanceCumulativeKm = cumulativeKm;
    }
    // Sort by cumulative km (order along the ride)
    pois.sort((a, b) => a.distanceCumulativeKm - b.distanceCumulativeKm);

    state.pois = pois;
    statusEl.textContent = `${pois.length} ${t("foundPoi")}`;
    statusEl.className = "status";

    resultsPanel.hidden = false;
    resultsCount.textContent = pois.length;
    renderCategories(); // refresh counts
    renderMarkers();
    renderResultsList();
  } catch (err) {
    console.error(err);
    statusEl.textContent = t("searchError") + " (" + err.message + ")";
    statusEl.className = "status error";
  } finally {
    searchBtn.disabled = false;
  }
}

// ---------- Marker rendering ----------
function renderMarkers() {
  state.markersGroup.clearLayers();
  for (const poi of state.pois) {
    if (!state.enabledCategories.has(poi.category)) continue;
    const cat = CATEGORIES[poi.category];
    const icon = L.divIcon({
      className: "",
      html: `<div class="poi-marker" style="background:${cat.color}">${cat.icon}</div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });
    const marker = L.marker([poi.lat, poi.lon], { icon });
    marker.bindPopup(() => buildPopupHtml(poi));
    marker._poiId = poi.id;
    state.markersGroup.addLayer(marker);
  }
}

function buildPopupHtml(poi) {
  const cat = CATEGORIES[poi.category];
  const name = poi.name || t("noName");
  const parts = [
    `<strong>${escapeHtml(name)}</strong>`,
    `<em>${cat.icon} ${t(cat.labelKey)}</em>`,
    `${t("distance")}: ${poi.distanceToTrack.toFixed(0)} m • ${t(
      "atKm"
    )} ${poi.distanceCumulativeKm.toFixed(1)} ${t("km")}`,
  ];
  if (poi.tags.opening_hours) {
    parts.push(`${t("openingHours")}: ${escapeHtml(poi.tags.opening_hours)}`);
  }
  const phone = poi.tags.phone || poi.tags["contact:phone"];
  if (phone) parts.push(`${t("phone")}: <a href="tel:${escapeHtml(phone)}">${escapeHtml(phone)}</a>`);
  const website = poi.tags.website || poi.tags["contact:website"];
  if (website) {
    parts.push(
      `${t("website")}: <a href="${escapeAttr(website)}" target="_blank" rel="noopener">${escapeHtml(
        website
      )}</a>`
    );
  }
  return parts.join("<br>");
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, "&quot;");
}

// ---------- Results list ----------
function renderResultsList() {
  resultsList.innerHTML = "";
  const visible = state.pois.filter((p) => state.enabledCategories.has(p.category));
  resultsCount.textContent = visible.length;
  if (visible.length === 0) {
    resultsPanel.hidden = state.pois.length === 0;
    return;
  }
  for (const poi of visible) {
    const cat = CATEGORIES[poi.category];
    const item = document.createElement("div");
    item.className = "result-item";
    item.innerHTML = `
      <div class="result-item-header">
        <span class="category-dot" style="background:${cat.color}">${cat.icon}</span>
        <span class="result-item-name">${escapeHtml(poi.name || t("noName"))}</span>
        <span class="result-item-distance">${poi.distanceCumulativeKm.toFixed(1)} ${t("km")}</span>
      </div>
      <div class="result-item-details">
        ${poi.distanceToTrack.toFixed(0)} m ${
      currentLang === "fr" ? "de la trace" : "from track"
    } • ${t(cat.labelKey)}
      </div>
    `;
    item.addEventListener("click", () => {
      map.setView([poi.lat, poi.lon], 16);
      // Open popup for this POI
      state.markersGroup.eachLayer((m) => {
        if (m._poiId === poi.id) m.openPopup();
      });
    });
    resultsList.appendChild(item);
  }
}

// ---------- Exports ----------
$("export-gpx").addEventListener("click", () => {
  const visible = state.pois.filter((p) => state.enabledCategories.has(p.category));
  if (visible.length === 0) return;
  downloadBlob(poisToGpx(visible), "cyclopoi-waypoints.gpx", "application/gpx+xml");
});
$("export-csv").addEventListener("click", () => {
  const visible = state.pois.filter((p) => state.enabledCategories.has(p.category));
  if (visible.length === 0) return;
  downloadBlob(poisToCsv(visible), "cyclopoi-waypoints.csv", "text/csv");
});

// ---------- Init ----------
setLang("fr");
renderCategories();

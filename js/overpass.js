// Overpass API queries
// Public endpoints — we failover in order if one fails.
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter",
];

// Build an Overpass QL query that finds POIs within `radiusMeters` of any
// point on the simplified track, for the selected categories.
function buildOverpassQuery(simplifiedPoints, radiusMeters, selectedCategories) {
  // around:radius,lat1,lon1,lat2,lon2,...
  const coordsStr = simplifiedPoints
    .map((p) => `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`)
    .join(",");
  const around = `around:${radiusMeters},${coordsStr}`;

  const statements = [];
  for (const catKey of selectedCategories) {
    const cat = CATEGORIES[catKey];
    if (!cat) continue;
    for (const filter of cat.filters) {
      // nodes + ways (some POIs are mapped as buildings/ways)
      statements.push(`  node(${around})${filter};`);
      statements.push(`  way(${around})${filter};`);
    }
  }

  return `[out:json][timeout:60];
(
${statements.join("\n")}
);
out center tags;`;
}

// Submit a query, trying endpoints in order. Returns parsed Overpass JSON.
async function runOverpassQuery(query) {
  let lastError = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "data=" + encodeURIComponent(query),
      });
      if (!res.ok) {
        lastError = new Error(`HTTP ${res.status}`);
        continue;
      }
      return await res.json();
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error("All Overpass endpoints failed");
}

// Normalize Overpass elements into POI objects: {id, lat, lon, name, tags, category}
function normalizeElements(elements) {
  const pois = [];
  const seen = new Set();
  for (const el of elements) {
    // For ways, Overpass returns a center when `out center` is used
    const lat = el.type === "node" ? el.lat : el.center && el.center.lat;
    const lon = el.type === "node" ? el.lon : el.center && el.center.lon;
    if (lat == null || lon == null) continue;

    const category = categorizeElement(el);
    if (!category) continue;

    // Dedupe: sometimes the same place has both a node and a way
    const name = (el.tags && el.tags.name) || "";
    const dedupKey = `${category}|${name}|${lat.toFixed(4)}|${lon.toFixed(4)}`;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);

    pois.push({
      id: `${el.type}/${el.id}`,
      lat,
      lon,
      name,
      tags: el.tags || {},
      category,
    });
  }
  return pois;
}

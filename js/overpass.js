// Overpass API queries
// Public endpoints — we failover in order if one fails.
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter",
];

// Max simplified points per query chunk. Keeps the POST body under ~30 KB.
const MAX_POINTS_PER_CHUNK = 80;

// Build an Overpass QL query for a chunk of the simplified track.
function buildOverpassQuery(simplifiedPoints, radiusMeters, selectedCategories) {
  const coordsStr = simplifiedPoints
    .map((p) => `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`)
    .join(",");
  const around = `around:${radiusMeters},${coordsStr}`;

  const statements = [];
  for (const catKey of selectedCategories) {
    const cat = CATEGORIES[catKey];
    if (!cat) continue;
    for (const filter of cat.filters) {
      statements.push(`  nw(${around})${filter};`);
    }
  }

  return `[out:json][timeout:90];
(
${statements.join("\n")}
);
out center tags;`;
}

// Split a simplified track into overlapping chunks of at most maxPts points.
// Overlap of ~5 points ensures no gap at chunk borders.
function chunkPoints(points, maxPts) {
  if (points.length <= maxPts) return [points];
  const overlap = 5;
  const step = maxPts - overlap;
  const chunks = [];
  for (let i = 0; i < points.length; i += step) {
    chunks.push(points.slice(i, i + maxPts));
    if (i + maxPts >= points.length) break;
  }
  return chunks;
}

// Run the full search: simplify track → chunk → query each chunk → merge.
// `onProgress(done, total)` is called after each chunk completes.
async function searchPois(trackPoints, radiusMeters, selectedCategories, onProgress) {
  // Adaptive simplification: cap at ~120 points per 100 km
  const trackLen = cumulativeDistances(trackPoints);
  const totalMeters = trackLen[trackLen.length - 1];
  const targetPoints = 120;
  const step = Math.max(500, totalMeters / targetPoints);
  const simplified = simplifyByDistance(trackPoints, step);

  const chunks = chunkPoints(simplified, MAX_POINTS_PER_CHUNK);
  const allElements = [];
  let done = 0;

  // Run chunks sequentially (Overpass rate-limits parallel requests)
  for (const chunk of chunks) {
    const query = buildOverpassQuery(chunk, radiusMeters, selectedCategories);
    const data = await runOverpassQuery(query);
    if (data.elements) allElements.push(...data.elements);
    done++;
    if (onProgress) onProgress(done, chunks.length);
  }

  return normalizeElements(allElements);
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
    const lat = el.type === "node" ? el.lat : el.center && el.center.lat;
    const lon = el.type === "node" ? el.lon : el.center && el.center.lon;
    if (lat == null || lon == null) continue;

    const category = categorizeElement(el);
    if (!category) continue;

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

// GPX parsing + geo utilities

// Parse a GPX file (string) and return an array of {lat, lon, ele?} trackpoints.
function parseGpx(xmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, "application/xml");

  const parserError = doc.querySelector("parsererror");
  if (parserError) throw new Error("Invalid XML");

  const pts = [];
  // Track points
  doc.querySelectorAll("trkpt").forEach((pt) => {
    const lat = parseFloat(pt.getAttribute("lat"));
    const lon = parseFloat(pt.getAttribute("lon"));
    if (!isNaN(lat) && !isNaN(lon)) pts.push({ lat, lon });
  });
  // Fallback to route points if no track
  if (pts.length === 0) {
    doc.querySelectorAll("rtept").forEach((pt) => {
      const lat = parseFloat(pt.getAttribute("lat"));
      const lon = parseFloat(pt.getAttribute("lon"));
      if (!isNaN(lat) && !isNaN(lon)) pts.push({ lat, lon });
    });
  }
  if (pts.length === 0) throw new Error("No trackpoints found");
  return pts;
}

// Haversine distance in meters
function haversine(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Cumulative distance array (meters from start)
function cumulativeDistances(points) {
  const cum = [0];
  for (let i = 1; i < points.length; i++) {
    cum.push(cum[i - 1] + haversine(points[i - 1], points[i]));
  }
  return cum;
}

// Total track length in km
function trackLengthKm(points) {
  const cum = cumulativeDistances(points);
  return cum[cum.length - 1] / 1000;
}

// Simplify track by distance: keep a point every `stepMeters` meters.
// Ensures Overpass URL stays manageable for long tracks.
function simplifyByDistance(points, stepMeters = 500) {
  if (points.length < 2) return points.slice();
  const result = [points[0]];
  let acc = 0;
  for (let i = 1; i < points.length; i++) {
    acc += haversine(points[i - 1], points[i]);
    if (acc >= stepMeters) {
      result.push(points[i]);
      acc = 0;
    }
  }
  // Always include last point
  const last = points[points.length - 1];
  const prev = result[result.length - 1];
  if (prev.lat !== last.lat || prev.lon !== last.lon) result.push(last);
  return result;
}

// Find the minimum distance (meters) from a POI to the track and the cumulative
// distance along the track to the nearest trackpoint.
function nearestOnTrack(poi, points, cumDistances) {
  let minDist = Infinity;
  let minIdx = 0;
  for (let i = 0; i < points.length; i++) {
    const d = haversine(poi, points[i]);
    if (d < minDist) {
      minDist = d;
      minIdx = i;
    }
  }
  return {
    distanceToTrack: minDist,
    cumulativeKm: cumDistances[minIdx] / 1000,
  };
}

// Compute bounding box [[minLat, minLon], [maxLat, maxLon]]
function boundingBox(points) {
  let minLat = Infinity, minLon = Infinity, maxLat = -Infinity, maxLon = -Infinity;
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lon < minLon) minLon = p.lon;
    if (p.lon > maxLon) maxLon = p.lon;
  }
  return [[minLat, minLon], [maxLat, maxLon]];
}

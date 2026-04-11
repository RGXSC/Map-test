// Export POIs as GPX waypoints or CSV

function xmlEscape(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function poisToGpx(pois) {
  const waypoints = pois
    .map((p) => {
      const name = p.name || t("noName");
      const desc = [
        `${t(CATEGORIES[p.category].labelKey)}`,
        `${p.distanceCumulativeKm.toFixed(1)} ${t("km")} - ${p.distanceToTrack.toFixed(0)} m ${
          currentLang === "fr" ? "de la trace" : "from track"
        }`,
        p.tags.opening_hours ? `${t("openingHours")}: ${p.tags.opening_hours}` : "",
        p.tags.phone ? `${t("phone")}: ${p.tags.phone}` : "",
        p.tags.website ? `${t("website")}: ${p.tags.website}` : "",
      ]
        .filter(Boolean)
        .join(" | ");
      return `  <wpt lat="${p.lat}" lon="${p.lon}">
    <name>${xmlEscape(name)}</name>
    <desc>${xmlEscape(desc)}</desc>
    <sym>${xmlEscape(CATEGORIES[p.category].icon)}</sym>
  </wpt>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="CycloPOI" xmlns="http://www.topografix.com/GPX/1/1">
${waypoints}
</gpx>`;
}

function poisToCsv(pois) {
  const header = [
    "name",
    "category",
    "lat",
    "lon",
    "distance_from_track_m",
    "cumulative_km",
    "opening_hours",
    "phone",
    "website",
  ];
  const rows = [header.join(",")];
  for (const p of pois) {
    const row = [
      p.name || "",
      t(CATEGORIES[p.category].labelKey),
      p.lat.toFixed(6),
      p.lon.toFixed(6),
      p.distanceToTrack.toFixed(0),
      p.distanceCumulativeKm.toFixed(2),
      p.tags.opening_hours || "",
      p.tags.phone || p.tags["contact:phone"] || "",
      p.tags.website || p.tags["contact:website"] || "",
    ].map(csvEscape);
    rows.push(row.join(","));
  }
  return rows.join("\n");
}

function csvEscape(val) {
  const s = String(val);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function downloadBlob(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

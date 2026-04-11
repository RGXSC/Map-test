// POI categories and their Overpass tag filters
// Each category defines the OSM tags to match + display metadata.
const CATEGORIES = {
  water: {
    labelKey: "water",
    color: "#2b7fff",
    icon: "💧",
    // Overpass tag filters (each entry matches nodes/ways with that tag)
    filters: [
      '["amenity"="drinking_water"]',
      '["amenity"="water_point"]',
      '["natural"="spring"]',
      '["man_made"="water_tap"]',
    ],
  },
  food: {
    labelKey: "food",
    color: "#f59e0b",
    icon: "🥖",
    filters: [
      '["shop"="supermarket"]',
      '["shop"="bakery"]',
      '["shop"="convenience"]',
      '["shop"="greengrocer"]',
      '["shop"="butcher"]',
    ],
  },
  lodging: {
    labelKey: "lodging",
    color: "#a855f7",
    icon: "🛏",
    filters: [
      '["tourism"="hotel"]',
      '["tourism"="hostel"]',
      '["tourism"="guest_house"]',
      '["tourism"="motel"]',
      '["tourism"="camp_site"]',
      '["tourism"="chalet"]',
    ],
  },
  bonus: {
    labelKey: "bonus",
    color: "#10b981",
    icon: "🔧",
    filters: [
      '["shop"="bicycle"]',
      '["amenity"="bicycle_repair_station"]',
      '["amenity"="cafe"]',
      '["amenity"="restaurant"]',
      '["amenity"="toilets"]',
      '["amenity"="shelter"]',
    ],
  },
};

// Determine which category an OSM element belongs to (first match wins).
function categorizeElement(el) {
  const tags = el.tags || {};
  for (const [key, cat] of Object.entries(CATEGORIES)) {
    for (const filter of cat.filters) {
      // filter looks like '["amenity"="drinking_water"]'
      const match = filter.match(/\["([^"]+)"="([^"]+)"\]/);
      if (match && tags[match[1]] === match[2]) {
        return key;
      }
    }
  }
  return null;
}

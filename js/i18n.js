// Internationalization (FR/EN)
const I18N = {
  fr: {
    title: "CycloPOI",
    upload: "Charger une trace GPX",
    dropHint: "Cliquez ou glissez un fichier .gpx ici",
    searchRadius: "Rayon de recherche",
    categories: "Catégories",
    searchBtn: "Rechercher les POI",
    searching: "Recherche en cours...",
    results: "Résultats",
    exportGpx: "Export GPX",
    exportCsv: "Export CSV",
    dataSource: "Données © OpenStreetMap contributors",
    trackLoaded: "Trace chargée",
    points: "points",
    distance: "Distance",
    noTrack: "Chargez d'abord une trace GPX",
    parseError: "Impossible de lire ce fichier GPX",
    searchError: "Erreur lors de la recherche Overpass",
    searchProgress: "Segment",
    foundPoi: "POI trouvés",
    selectOne: "Sélectionnez au moins une catégorie",
    km: "km",
    atKm: "à",
    openingHours: "Horaires",
    phone: "Téléphone",
    website: "Site web",
    noName: "Sans nom",
    water: "Points d'eau",
    food: "Ravitaillement",
    lodging: "Hébergement",
    bonus: "Bonus cycliste",
  },
  en: {
    title: "CycloPOI",
    upload: "Upload GPX track",
    dropHint: "Click or drop a .gpx file here",
    searchRadius: "Search radius",
    categories: "Categories",
    searchBtn: "Search POIs",
    searching: "Searching...",
    results: "Results",
    exportGpx: "Export GPX",
    exportCsv: "Export CSV",
    dataSource: "Data © OpenStreetMap contributors",
    trackLoaded: "Track loaded",
    points: "points",
    distance: "Distance",
    noTrack: "Please load a GPX track first",
    parseError: "Failed to parse GPX file",
    searchError: "Overpass search failed",
    searchProgress: "Segment",
    foundPoi: "POIs found",
    selectOne: "Please select at least one category",
    km: "km",
    atKm: "at",
    openingHours: "Opening hours",
    phone: "Phone",
    website: "Website",
    noName: "Unnamed",
    water: "Water points",
    food: "Food supplies",
    lodging: "Lodging",
    bonus: "Cyclist bonus",
  },
};

let currentLang = "fr";

function setLang(lang) {
  if (!I18N[lang]) return;
  currentLang = lang;
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (I18N[lang][key]) el.textContent = I18N[lang][key];
  });
  document.querySelectorAll(".lang-switcher button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.lang === lang);
  });
  // Trigger re-render for dynamic content
  if (window.onLangChange) window.onLangChange();
}

function t(key) {
  return I18N[currentLang][key] || key;
}

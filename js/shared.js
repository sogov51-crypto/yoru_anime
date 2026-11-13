let animeList = [];

let savedStatuses = {};

try {
  savedStatuses = JSON.parse(localStorage.getItem("yoruStatuses") || "{}");
} catch (e) {
  savedStatuses = {};
}

let favoriteIds = [];
try { favoriteIds = JSON.parse(localStorage.getItem("yoruFavorites") || "[]"); } catch (e) { favoriteIds = []; }
let profileData = { name: "", avatarUrl: "", avatarData: "", bannerUrl: "", bannerData: "", bannerVideo: "", dockStyle: "glass", dockRadius: 30, dockOpacity: 78, dockBlur: 24, dockWidth: 430, dockHeight: 66, dockPosition: null, dockOrientation: "horizontal", dockLabels: "show", dockPresets: [] };
try { profileData = { ...profileData, ...JSON.parse(localStorage.getItem("yoruProfile") || '{"name":""}') }; } catch (e) { profileData = { ...profileData }; }
let currentView = "home";

const statusNames = {
  watching: "Смотрю",
  watched: "Просмотрено",
  planned: "В планах",
  dropped: "Брошено",
  unset: "Не добавлено"
};

let currentFilter = "all";
let activeAnime = null;
let popularPeriod = "alltime";
let popularAnime = [];
let popularRequestId = 0;
let catalogLoading = false;
let catalogLoadedPages = new Set([1]);
let visibleLimit = 48;

let catalogBackgroundStarted = false;
let catalogLastCachedPage = 1;

const CURRENT_YEAR = new Date().getFullYear();
let popularSort = "popularity";
let popularMinScore = 0;

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[c]);
}

function word(n) {
  if (n % 10 === 1 && n % 100 !== 11) return "тайтл";
  if ([2, 3, 4].includes(n % 10) &&
      ![12, 13, 14].includes(n % 100)) return "тайтла";
  return "тайтлов";
}

let toastTimer;

function toast(message) {
  const t = document.getElementById("toast");
  t.textContent = message;
  t.classList.add("show");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.classList.remove("show");
  }, 2000);
}

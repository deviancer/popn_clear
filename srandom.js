"use strict";

const {
  TABLE_IDS,
  STATUS_LABELS,
  nextStatus,
  parseSrandomText,
  recordStatus,
  remapRecordTable,
} = window.POPN_SRANDOM_DATA;

const requestedTable = new URLSearchParams(window.location.search).get("table");
const initialTable = requestedTable === "0" ? "5" : requestedTable;
let currentTable = TABLE_IDS.includes(initialTable) ? initialTable : "1";
let catalog = { table: currentTable, groups: [], songs: [] };
let records = {};
let activeGroup = "all";
let activeStatus = "all";
let query = "";

const tableLabel = document.querySelector("#sran-table-label");
const pageTitle = document.querySelector("#sran-page-title");
const progressLabel = document.querySelector("#sran-progress-label");
const progressBar = document.querySelector("#sran-progress-bar");
const statusFilters = document.querySelector("#sran-status-filters");
const groupFilters = document.querySelector("#sran-group-filters");
const songList = document.querySelector("#sran-song-list");
const searchInput = document.querySelector("#sran-search");
const resultSummary = document.querySelector("#sran-result-summary");

function storageKey(table = currentTable) {
  return `popn_clear_sran${table}`;
}

function readStoredRecords(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch (error) {
    console.error(error);
    return {};
  }
}

function loadRecords(table) {
  const current = readStoredRecords(storageKey(table));
  if (table !== "5") return current;

  const legacy = remapRecordTable(readStoredRecords(storageKey("0")), "0", "5");
  const migrated = { ...legacy, ...current };
  if (Object.keys(legacy).length) {
    localStorage.setItem(storageKey("5"), JSON.stringify(migrated));
  }
  return migrated;
}

function saveRecords() {
  localStorage.setItem(storageKey(), JSON.stringify(records));
}

function statusFor(song) {
  return recordStatus(records, song);
}

function statusCounts(songs = catalog.songs) {
  const counts = { unplayed: 0, easyClear: 0, clear: 0, fail: 0 };
  songs.forEach((song) => {
    const status = statusFor(song);
    if (status === "easy-clear") counts.easyClear += 1;
    else counts[status || "unplayed"] += 1;
  });
  return counts;
}

function groupSongs(group) {
  return catalog.songs.filter((song) => song.sranDifficulty === group);
}

function matchesFilters(song) {
  if (activeGroup !== "all" && song.sranDifficulty !== activeGroup) return false;

  const status = statusFor(song) || "unplayed";
  if (activeStatus !== "all" && status !== activeStatus) return false;

  return `${song.genre} ${song.level} ${song.sranDifficulty}`
    .toLowerCase()
    .includes(query.trim().toLowerCase());
}

function makeFilterButton(label, count, value, kind) {
  const button = document.createElement("button");
  const selected = kind === "status" ? activeStatus === value : activeGroup === value;
  button.type = "button";
  button.className = `sran-filter-button${selected ? " active" : ""}`;
  button.setAttribute("aria-pressed", String(selected));

  const text = document.createElement("strong");
  text.textContent = label;
  const total = document.createElement("span");
  total.textContent = count;
  button.append(text, total);

  button.addEventListener("click", () => {
    if (kind === "status") activeStatus = value;
    else activeGroup = value;
    renderSidebar();
    renderSongs();
  });
  return button;
}

function renderSidebar() {
  const counts = statusCounts();
  const total = catalog.songs.length;
  const cleared = counts.easyClear + counts.clear;
  progressLabel.textContent = `${cleared} / ${total}`;
  progressBar.style.width = `${total ? (cleared / total) * 100 : 0}%`;

  statusFilters.replaceChildren(
    makeFilterButton("全部", total, "all", "status"),
    makeFilterButton("未游玩", counts.unplayed, "unplayed", "status"),
    makeFilterButton("EASY-CLEAR", counts.easyClear, "easy-clear", "status"),
    makeFilterButton("CLEAR", counts.clear, "clear", "status"),
    makeFilterButton("FAIL", counts.fail, "fail", "status"),
  );

  groupFilters.replaceChildren(
    makeFilterButton("ALL", `${cleared}/${total}`, "all", "group"),
    ...catalog.groups.map((group) => {
      const songs = groupSongs(group);
      const groupCounts = statusCounts(songs);
      const groupCleared = groupCounts.easyClear + groupCounts.clear;
      return makeFilterButton(group, `${groupCleared}/${songs.length}`, group, "group");
    }),
  );
}

function applyCardStatus(card, song) {
  const status = statusFor(song);
  card.dataset.status = status || "unplayed";
  card.classList.toggle("status-easy-clear", status === "easy-clear");
  card.classList.toggle("status-clear", status === "clear");
  card.classList.toggle("status-fail", status === "fail");
  card.querySelector(".sran-card-status").textContent = STATUS_LABELS[status];
  card.setAttribute(
    "aria-label",
    `${song.genre}，Lv${song.level}，${STATUS_LABELS[status]}。点击切换状态`,
  );
}

function renderCard(song) {
  const card = document.createElement("button");
  card.type = "button";
  card.className = "sran-card";
  card.title = "点击切换：未游玩 → EASY-CLEAR → CLEAR → FAIL";

  const difficulty = document.createElement("span");
  difficulty.className = "sran-card-difficulty";
  difficulty.textContent = song.sranDifficulty;

  const genre = document.createElement("strong");
  genre.className = "sran-card-genre";
  genre.textContent = song.genre;

  const footer = document.createElement("span");
  footer.className = "sran-card-footer";
  const level = document.createElement("b");
  level.textContent = `Lv${song.level}`;
  const status = document.createElement("em");
  status.className = "sran-card-status";
  footer.append(level, status);

  card.append(difficulty, genre, footer);
  applyCardStatus(card, song);
  card.addEventListener("click", () => {
    const next = nextStatus(statusFor(song));
    if (next) records[song.id] = { status: next };
    else delete records[song.id];
    saveRecords();
    renderSidebar();
    renderSongs();
  });
  return card;
}

function renderSongs() {
  const visible = catalog.songs.filter(matchesFilters);
  const fragment = document.createDocumentFragment();

  catalog.groups.forEach((group) => {
    const songs = visible.filter((song) => song.sranDifficulty === group);
    if (!songs.length) return;

    const section = document.createElement("section");
    section.className = "sran-section";
    const heading = document.createElement("div");
    heading.className = "sran-section-heading";
    const title = document.createElement("h2");
    title.textContent = group;
    const count = document.createElement("span");
    count.textContent = `${songs.length} songs`;
    heading.append(title, count);

    const grid = document.createElement("div");
    grid.className = "sran-card-grid";
    songs.forEach((song) => grid.append(renderCard(song)));
    section.append(heading, grid);
    fragment.append(section);
  });

  resultSummary.textContent = `显示 ${visible.length} / ${catalog.songs.length} 首`;
  if (!visible.length) {
    const empty = document.createElement("p");
    empty.className = "sran-empty";
    empty.textContent = "没有符合当前筛选条件的歌曲。";
    fragment.append(empty);
  }
  songList.replaceChildren(fragment);
}

function updateNavigation() {
  document.querySelectorAll("[data-sran-table]").forEach((link) => {
    const active = link.dataset.sranTable === currentTable;
    link.classList.toggle("active", active);
    link.classList.toggle("muted", !active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  tableLabel.textContent = `Sran${currentTable}`;
  pageTitle.textContent = `Sran${currentTable} S-RANDOM表`;
  document.title = `popn_clear - Sran${currentTable}`;
}

async function loadTable(table) {
  if (!TABLE_IDS.includes(table)) return;
  currentTable = table;
  activeGroup = "all";
  activeStatus = "all";
  query = "";
  searchInput.value = "";
  updateNavigation();
  songList.textContent = "正在加载…";

  const response = await fetch(`./diff/Sran${table}.txt`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to load diff/Sran${table}.txt`);
  catalog = parseSrandomText(await response.text(), table);
  records = loadRecords(table);
  renderSidebar();
  renderSongs();
}

document.querySelectorAll("[data-sran-table]").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    const table = link.dataset.sranTable;
    window.history.replaceState(null, "", `${window.location.pathname}?table=${table}`);
    loadTable(table).catch(showLoadError);
  });
});

searchInput.addEventListener("input", () => {
  query = searchInput.value;
  renderSongs();
});

function showLoadError(error) {
  console.error(error);
  songList.textContent = `无法加载 diff/Sran${currentTable}.txt`;
}

loadTable(currentTable).catch(showLoadError);

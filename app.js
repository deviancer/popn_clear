const iconPath = (name) => `./icon/${name}.png`;

const AVAILABLE_LEVELS = ["46", "47", "48", "49", "50"];
const MAJOR_ORDER = ["入門", "逆詐称", "弱", "中", "強", "詐称", "別格", "未定"];

const CLEAR_OPTIONS = [
  { value: "", label: "-" },
  { value: "fail", label: "fail", className: "status-fail" },
  { value: "clear", label: "clear", className: "status-clear" },
  { value: "fc", label: "full combo", className: "status-fc" },
  { value: "perfect", label: "perfect", className: "status-perfect" },
];

const MEDAL_LABELS = {
  c_1: "青●",
  c_2: "青◆",
  c_3: "青★",
  c_4: "緑●",
  c_5: "橙☘",
  c_6: "銅●",
  c_7: "銅◆",
  c_8: "銅★",
  c_9: "銀●",
  c_10: "銀◆",
  c_11: "銀★",
  c_12: "金★",
};

const MEDALS_BY_CLEAR = {
  fail: ["c_1", "c_2", "c_3"],
  clear: ["c_4", "c_5", "c_6", "c_7", "c_8"],
  fc: ["c_9", "c_10", "c_11"],
  perfect: ["c_12"],
};

const MEDAL_STATUS_CLASS = {
  c_1: "status-fail",
  c_2: "status-fail",
  c_3: "status-fail",
  c_4: "status-clear-green",
  c_5: "status-clear-orange",
  c_6: "status-clear",
  c_7: "status-clear",
  c_8: "status-clear",
  c_9: "status-fc",
  c_10: "status-fc",
  c_11: "status-fc",
  c_12: "status-perfect",
};

const SCORE_RANKS = [
  { value: "", label: "-" },
  { value: "s_12", label: "S+" },
  { value: "s_11", label: "S" },
  { value: "s_10", label: "AAA" },
  { value: "s_9", label: "AA+" },
  { value: "s_8", label: "AA" },
  { value: "s_7_failed", label: "A+ failed" },
  { value: "s_7", label: "A+" },
  { value: "s_6", label: "A" },
  { value: "s_5", label: "B+" },
  { value: "s_4", label: "B" },
  { value: "s_3", label: "C" },
  { value: "s_2", label: "D" },
  { value: "s_1", label: "E" },
];

const CHART_ITEMS = [
  { value: "fail", label: "fail", color: "#5f7f99" },
  { value: "clear", label: "clear", color: "#bd806b" },
  { value: "fc", label: "full combo", color: "#9aa5ad" },
  { value: "perfect", label: "perfect", color: "#d2b56f" },
  { value: "blank", label: "未入力", color: "#dfe2ea" },
];

const stateByLevel = {};
const songsByLevel = {};
const initialLevel = new URLSearchParams(window.location.search).get("level");
let currentLevel = AVAILABLE_LEVELS.includes(initialLevel) ? initialLevel : "46";
let activeFilter = { type: "all" };
let query = "";
let sortAscending = true;
let songs = [];
const collapsedLeftMajors = new Set();
const collapsedRightSections = new Set();

const sectionTemplate = document.querySelector("#song-section-template");
const cardTemplate = document.querySelector("#song-card-template");
const songList = document.querySelector("#song-list");
const groupList = document.querySelector("#group-list");
const searchInput = document.querySelector("#search");
const clearCount = document.querySelector("#clear-count");
const clearProgress = document.querySelector("#clear-progress");
const sortToggle = document.querySelector("#sort-toggle");
const sortLabel = document.querySelector("#sort-label");
const lampPie = document.querySelector("#lamp-pie");
const pieLegend = document.querySelector("#pie-legend");
const currentLevelLabel = document.querySelector("#current-level");
const pageTitle = document.querySelector("#page-title");
const profileMenuToggle = document.querySelector("#profile-menu-toggle");
const profileDropdown = document.querySelector("#profile-dropdown");
const profileName = document.querySelector("#profile-name");

function loadState(level) {
  if (!stateByLevel[level]) {
    stateByLevel[level] = JSON.parse(localStorage.getItem(`popn_clear_lv${level}`) || "{}");
  }
  return stateByLevel[level];
}

function saveState() {
  localStorage.setItem(`popn_clear_lv${currentLevel}`, JSON.stringify(loadState(currentLevel)));
}

function saveStateForLevel(level) {
  localStorage.setItem(`popn_clear_lv${level}`, JSON.stringify(loadState(level)));
}

function localBackupKey(level = currentLevel) {
  return `popn_clear_local_backup_lv${level}`;
}

function buildLevelSnapshot(level = currentLevel) {
  return {
    app: "popn_clear",
    version: 1,
    type: "level-records",
    level,
    exportedAt: new Date().toISOString(),
    records: loadState(level),
  };
}

function buildAccountSyncPayload(level = currentLevel) {
  const state = loadState(level);
  const counts = { fail: 0, clear: 0, fc: 0, perfect: 0, blank: 0 };
  const levelSongs = songsByLevel[level] || (level === currentLevel ? songs : []);

  levelSongs.forEach((song) => {
    const record = state[songId(song)] || {};
    normalizeRecord(record);
    counts[recordKind(record)] += 1;
  });

  return {
    level,
    total: levelSongs.length,
    clear: counts.clear + counts.fc + counts.perfect,
    fail: counts.fail,
    fullCombo: counts.fc,
    perfect: counts.perfect,
    records: state,
    updatedAt: new Date().toISOString(),
  };
}

function currentUserId() {
  return localStorage.getItem("popn_clear_user_id") || "";
}

function updateProfileName() {
  const userId = currentUserId();
  if (profileName) profileName.textContent = userId || "guest";
  document.querySelector('[data-auth-action="logout"]')?.toggleAttribute("hidden", !userId);
}

function promptForUserId(mode) {
  const label = mode === "register" ? "注册账号" : "登录";
  const suggested = currentUserId() || "";
  const userId = window.prompt(`${label}：请输入要显示的玩家 ID`, suggested);
  if (userId === null) return;

  const cleanId = userId.trim();
  if (!cleanId) {
    window.alert("玩家 ID 不能为空。");
    return;
  }

  localStorage.setItem("popn_clear_user_id", cleanId);
  updateProfileName();
}

function logoutUser() {
  localStorage.removeItem("popn_clear_user_id");
  updateProfileName();
}

function saveCurrentLevelToLocalBackup() {
  localStorage.setItem(localBackupKey(), JSON.stringify(buildLevelSnapshot()));
  window.alert(`Lv${currentLevel} 已保存到本机浏览器缓存。`);
}

function loadCurrentLevelFromLocalBackup() {
  const raw = localStorage.getItem(localBackupKey());
  if (!raw) {
    window.alert(`还没有找到 Lv${currentLevel} 的本地缓存备份。`);
    return;
  }

  try {
    const payload = JSON.parse(raw);
    const records = payload.records;
    if (!records || typeof records !== "object" || Array.isArray(records)) {
      window.alert("本地缓存数据格式不正确。");
      return;
    }

    const exportedAt = payload.exportedAt ? `\n缓存时间：${new Date(payload.exportedAt).toLocaleString()}` : "";
    const shouldLoad = window.confirm(`将从本机缓存恢复 Lv${currentLevel}，并覆盖当前 Lv${currentLevel} 数据。${exportedAt}`);
    if (!shouldLoad) return;

    stateByLevel[currentLevel] = records;
    saveStateForLevel(currentLevel);
    renderGroups();
    renderSongs();
  } catch (error) {
    window.alert("读取本地缓存失败。");
    console.error(error);
  }
}

function showAccountSyncPlaceholder(action) {
  const userId = currentUserId();
  if (!userId) {
    window.alert("请先点击 guest 登录或注册账号。");
    setProfileMenuOpen(true);
    return;
  }

  const payload = buildAccountSyncPayload();
  payload.userId = userId;
  console.info("Account sync payload preview:", payload);
  window.alert(
    action === "save"
      ? "上传至账号的资料结构已经准备好。接入登录和 Supabase 后，这里会把当前等级数据同步到账号。"
      : "从账号加载的入口已经预留。接入登录和 Supabase 后，这里会读取账号里的等级数据。",
  );
}

function parseDiffText(text, level) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line, index) => {
      const columns = line.split("\t");
      const hasLicensedColumn = columns.length >= 8;
      const [versionRaw, licensedRaw, genre, title, bpm, time, notesRaw, difficultyRaw] = hasLicensedColumn
        ? columns
        : [columns[0], "", columns[1], columns[2], columns[3], columns[4], columns[5], columns[6]];
      const difficulty = (difficultyRaw || "").trim() || "未定";
      const group = parseDifficultyGroup(difficulty);
      return {
        id: `${level}-${index}-${genre || title}`,
        level,
        version: cleanBracket(versionRaw),
        licensed: /\[版\]/.test(licensedRaw || ""),
        genre: (genre || "").trim(),
        title: (title || "").trim(),
        bpm: (bpm || "").trim(),
        time: (time || "").trim(),
        notes: Number((notesRaw || "").replace(/[^\d]/g, "")) || 0,
        difficulty,
        major: group.major,
        minor: group.minor,
        minorValue: group.minorValue,
      };
    });
}

function cleanBracket(value = "") {
  return value.trim().replace(/^\[/, "").replace(/\]$/, "");
}

function parseDifficultyGroup(difficulty) {
  const trimmed = difficulty.trim();
  if (!trimmed || trimmed === "未定") {
    return { major: "未定", minor: "未定", minorValue: Number.POSITIVE_INFINITY };
  }

  const major = MAJOR_ORDER.find((name) => trimmed.startsWith(name)) || "未定";
  const value = Number((trimmed.match(/([+-]\d+(?:\.\d+)?)/) || [])[1]);
  if (!Number.isFinite(value)) {
    return { major, minor: "未定", minorValue: Number.POSITIVE_INFINITY };
  }

  const truncated = Math.trunc(value * 10) / 10;
  const minor = `${major}${formatSignedDecimal(truncated)}`;
  return { major, minor, minorValue: truncated };
}

function formatSignedDecimal(value) {
  const fixed = Math.abs(value).toFixed(1);
  return `${value >= 0 ? "+" : "-"}${fixed}`;
}

function orderedMajors() {
  const present = [...new Set(songs.map((song) => song.major))];
  const ordered = MAJOR_ORDER.filter((major) => present.includes(major));
  return sortAscending ? ordered : ordered.reverse();
}

function orderedMinors(major) {
  const minorMap = new Map();
  songs
    .filter((song) => song.major === major)
    .forEach((song) => {
      if (!minorMap.has(song.minor)) {
        minorMap.set(song.minor, song.minorValue);
      }
    });

  const minors = [...minorMap.entries()].sort((a, b) => {
    if (a[1] === b[1]) return a[0].localeCompare(b[0], "ja");
    return a[1] - b[1];
  });
  return (sortAscending ? minors : minors.reverse()).map(([minor]) => minor);
}

function songId(song) {
  return song.id;
}

function fillOptions(select, options) {
  select.replaceChildren(
    ...options.map((option) => {
      const element = document.createElement("option");
      element.value = option.value;
      element.textContent = option.label;
      return element;
    }),
  );
}

function normalizeRecord(record) {
  if (record.clear === "failed") record.clear = "fail";
  if (record.clear === "normal" || record.clear === "easy") record.clear = "clear";
}

function medalOptions(clearValue) {
  return [
    { value: "", label: "-" },
    ...(MEDALS_BY_CLEAR[clearValue] || []).map((name) => ({
      value: name,
      label: MEDAL_LABELS[name],
    })),
  ];
}

function statusClass(record) {
  if (record.medal && MEDAL_STATUS_CLASS[record.medal]) return MEDAL_STATUS_CLASS[record.medal];
  const option = CLEAR_OPTIONS.find((item) => item.value === record.clear);
  return option?.className || "";
}

function applyCardStatus(card, record) {
  Object.values(MEDAL_STATUS_CLASS).forEach((className) => card.classList.remove(className));
  CLEAR_OPTIONS.forEach((option) => {
    if (option.className) card.classList.remove(option.className);
  });
  const className = statusClass(record);
  if (className) card.classList.add(className);
}

function updateIcon(img, value) {
  if (!value) {
    img.hidden = true;
    img.removeAttribute("src");
    return;
  }
  img.src = iconPath(value === "s_7_failed" ? "s_7" : value);
  img.hidden = false;
}

function recordKind(record) {
  if (!record?.clear) return "blank";
  if (record.clear === "fc" || record.clear === "perfect" || record.clear === "fail") return record.clear;
  return "clear";
}

function songsForFilter(filter) {
  if (filter.type === "all") return songs;
  if (filter.type === "major") return songs.filter((song) => song.major === filter.major);
  return songs.filter((song) => song.major === filter.major && song.minor === filter.minor);
}

function aggregateLamp(songGroup) {
  if (!songGroup.length) return "";

  const state = loadState(currentLevel);
  const rank = { fail: 1, clear: 2, fc: 3, perfect: 4 };
  let lowest = Number.POSITIVE_INFINITY;

  for (const song of songGroup) {
    const record = state[songId(song)] || {};
    normalizeRecord(record);
    const kind = recordKind(record);
    if (kind === "blank") return "";
    lowest = Math.min(lowest, rank[kind]);
  }

  return Object.entries(rank).find(([, value]) => value === lowest)?.[0] || "";
}

function lampClassForFilter(filter) {
  const lamp = aggregateLamp(songsForFilter(filter));
  return lamp ? `lamp-${lamp}` : "";
}

function updateProgress() {
  const state = loadState(currentLevel);
  const total = songs.length;
  const counts = { fail: 0, clear: 0, fc: 0, perfect: 0, blank: 0 };

  songs.forEach((song) => {
    const record = state[songId(song)] || {};
    normalizeRecord(record);
    counts[recordKind(record)] += 1;
  });

  const cleared = counts.clear + counts.fc + counts.perfect;
  clearCount.textContent = `${cleared} / ${total}`;
  clearProgress.style.width = `${total ? (cleared / total) * 100 : 0}%`;
  updatePie(counts, total);
}

function updatePie(counts, total) {
  let current = 0;
  const stops = CHART_ITEMS.map((item) => {
    const start = current;
    current += total ? (counts[item.value] / total) * 100 : 0;
    return `${item.color} ${start}% ${current}%`;
  });

  lampPie.style.background = `conic-gradient(${stops.join(", ")})`;
  pieLegend.replaceChildren(
    ...CHART_ITEMS.map((item) => {
      const row = document.createElement("span");
      row.innerHTML = `<i style="background:${item.color}"></i><b>${item.label}</b><em>${counts[item.value]}</em>`;
      return row;
    }),
  );
}

function countForFilter(filter) {
  if (filter.type === "all") return songs.length;
  if (filter.type === "major") return songs.filter((song) => song.major === filter.major).length;
  return songs.filter((song) => song.major === filter.major && song.minor === filter.minor).length;
}

function filterKey(filter) {
  if (filter.type === "all") return "all";
  if (filter.type === "major") return `major:${filter.major}`;
  return `sub:${filter.major}:${filter.minor}`;
}

function isActive(filter) {
  return filterKey(activeFilter) === filterKey(filter);
}

function makeGroupButton(filter, label, count, className = "") {
  const button = document.createElement("button");
  button.className = `group-button ${className} ${lampClassForFilter(filter)}${isActive(filter) ? " active" : ""}`;
  button.type = "button";
  button.innerHTML = `<strong>${label}</strong><span>${count}</span>`;
  button.addEventListener("click", () => {
    activeFilter = filter;
    renderGroups();
    renderSongs();
  });
  return button;
}

function makeMajorGroupRow(major) {
  const filter = { type: "major", major };
  const row = document.createElement("div");
  const collapsed = collapsedLeftMajors.has(leftMajorKey(major));
  row.className = "group-row";
  row.append(makeGroupButton(filter, major, countForFilter(filter), "major"));
  row.append(makeCollapseButton(collapsed, () => {
    toggleSet(collapsedLeftMajors, leftMajorKey(major));
    renderGroups();
  }));
  return row;
}

function makeCollapseButton(collapsed, onClick) {
  const button = document.createElement("button");
  button.className = "collapse-button";
  button.type = "button";
  button.setAttribute("aria-label", collapsed ? "展开" : "收起");
  button.textContent = collapsed ? "+" : "−";
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    onClick();
  });
  return button;
}

function toggleSet(set, key) {
  if (set.has(key)) {
    set.delete(key);
  } else {
    set.add(key);
  }
}

function leftMajorKey(major) {
  return `${currentLevel}:left:${major}`;
}

function rightSectionKey(type, major, minor = "") {
  return `${currentLevel}:right:${type}:${major}:${minor}`;
}

function renderGroups() {
  const nodes = [makeGroupButton({ type: "all" }, "ALL", songs.length)];

  orderedMajors().forEach((major) => {
    nodes.push(makeMajorGroupRow(major));
    if (!collapsedLeftMajors.has(leftMajorKey(major))) {
      orderedMinors(major).forEach((minor) => {
        nodes.push(
          makeGroupButton(
            { type: "sub", major, minor },
            minor === "未定" ? "未定" : minor.replace(major, ""),
            countForFilter({ type: "sub", major, minor }),
            "minor",
          ),
        );
      });
    }
  });

  groupList.replaceChildren(...nodes);
}

function songMatches(song) {
  const filterOk =
    activeFilter.type === "all" ||
    (activeFilter.type === "major" && song.major === activeFilter.major) ||
    (activeFilter.type === "sub" && song.major === activeFilter.major && song.minor === activeFilter.minor);
  const text = `${song.genre} ${song.title} ${song.difficulty}`.toLowerCase();
  return filterOk && text.includes(query.trim().toLowerCase());
}

function renderCard(song) {
  const state = loadState(currentLevel);
  const id = songId(song);
  const record = state[id] || {};
  normalizeRecord(record);
  const node = cardTemplate.content.firstElementChild.cloneNode(true);
  const clearSelect = node.querySelector(".clear-select");
  const medalSelect = node.querySelector(".medal-select");
  const scoreInput = node.querySelector(".score-input");
  const scoreRankSelect = node.querySelector(".score-rank-select");
  const medalPreview = node.querySelector(".medal-preview");
  const scorePreview = node.querySelector(".score-preview");

  node.querySelector(".genre").textContent = song.genre;
  node.querySelector(".title").textContent = song.title;
  node.querySelector(".notes").textContent = song.notes || "-";
  node.querySelector(".difficulty").textContent = song.difficulty;
  node.querySelector(".danger-badge").hidden = Number(song.notes) < 1537;

  fillOptions(clearSelect, CLEAR_OPTIONS);
  fillOptions(medalSelect, medalOptions(record.clear));
  fillOptions(scoreRankSelect, SCORE_RANKS);

  clearSelect.value = record.clear || "";
  medalSelect.value = record.medal || "";
  scoreInput.value = record.score || "";
  scoreRankSelect.value = record.scoreRank || "";

  applyCardStatus(node, record);
  updateIcon(medalPreview, medalSelect.value);
  updateIcon(scorePreview, scoreRankSelect.value);

  clearSelect.addEventListener("change", () => {
    const nextMedals = medalOptions(clearSelect.value);
    const allowed = nextMedals.some((option) => option.value === medalSelect.value);
    fillOptions(medalSelect, nextMedals);
    medalSelect.value = allowed ? medalSelect.value : "";

    state[id] = {
      ...(state[id] || {}),
      clear: clearSelect.value,
      medal: medalSelect.value,
    };
    applyCardStatus(node, state[id]);
    updateIcon(medalPreview, medalSelect.value);
    saveState();
    updateProgress();
    renderGroups();
  });

  medalSelect.addEventListener("change", () => {
    state[id] = {
      ...(state[id] || {}),
      clear: clearSelect.value,
      medal: medalSelect.value,
    };
    applyCardStatus(node, state[id]);
    updateIcon(medalPreview, medalSelect.value);
    saveState();
    updateProgress();
    renderGroups();
  });

  scoreInput.addEventListener("input", () => {
    const value = scoreInput.value ? Math.min(100000, Math.max(0, Number(scoreInput.value))) : "";
    if (value !== "") scoreInput.value = value;
    state[id] = { ...(state[id] || {}), score: scoreInput.value };
    saveState();
  });

  scoreRankSelect.addEventListener("change", () => {
    state[id] = { ...(state[id] || {}), scoreRank: scoreRankSelect.value };
    updateIcon(scorePreview, scoreRankSelect.value);
    saveState();
  });

  return node;
}

function makeSection(title, count, headingClass = "", collapseKey = "") {
  const section = sectionTemplate.content.firstElementChild.cloneNode(true);
  section.classList.add(headingClass);
  section.querySelector("h2").textContent = title;
  section.querySelector(".section-heading span").textContent = `${count} songs`;
  if (collapseKey) {
    const collapsed = collapsedRightSections.has(collapseKey);
    const heading = section.querySelector(".section-heading");
    heading.append(makeCollapseButton(collapsed, () => {
      toggleSet(collapsedRightSections, collapseKey);
      renderSongs();
    }));
    section.classList.toggle("collapsed", collapsed);
  }
  return section;
}

function visibleSongsForMinor(major, minor) {
  return songs.filter((song) => song.major === major && song.minor === minor && songMatches(song));
}

function renderSongs() {
  const fragment = document.createDocumentFragment();
  const majors =
    activeFilter.type === "all"
      ? orderedMajors()
      : orderedMajors().filter((major) => major === activeFilter.major);

  majors.forEach((major) => {
    const majorVisible = songs.filter((song) => song.major === major && songMatches(song));
    if (!majorVisible.length) return;

    const majorKey = rightSectionKey("major", major);
    const majorCollapsed = collapsedRightSections.has(majorKey);
    const majorSection = makeSection(major, majorVisible.length, "major-section", majorKey);
    fragment.append(majorSection);
    if (majorCollapsed) return;

    orderedMinors(major).forEach((minor) => {
      if (activeFilter.type === "sub" && activeFilter.minor !== minor) return;
      const minorSongs = visibleSongsForMinor(major, minor);
      if (!minorSongs.length) return;

      const minorSection = makeSection(minor, minorSongs.length, "minor-section", rightSectionKey("minor", major, minor));
      const list = minorSection.querySelector(".song-list");
      if (!collapsedRightSections.has(rightSectionKey("minor", major, minor))) {
        minorSongs.forEach((song) => list.append(renderCard(song)));
      }
      fragment.append(minorSection);
    });
  });

  songList.replaceChildren(fragment);
  updateProgress();
}

function updateLevelNav() {
  document.querySelectorAll(".level-pill[data-level]").forEach((button) => {
    const isActiveLevel = button.dataset.level === currentLevel;
    button.classList.toggle("active", isActiveLevel);
    button.classList.toggle("muted", !isActiveLevel);
  });
  currentLevelLabel.textContent = currentLevel;
  pageTitle.textContent = `Lv${currentLevel} Record Sheet`;
  document.title = `popn_clear - Lv${currentLevel}`;
}

async function loadLevel(level) {
  if (!AVAILABLE_LEVELS.includes(level)) return;
  currentLevel = level;
  activeFilter = { type: "all" };
  query = "";
  searchInput.value = "";
  updateLevelNav();

  if (!songsByLevel[level]) {
    const response = await fetch(`./diff/${level}.txt`, { cache: "no-store" });
    const text = await response.text();
    songsByLevel[level] = parseDiffText(text, level);
  }

  songs = songsByLevel[level];
  loadState(level);
  renderGroups();
  renderSongs();
}

searchInput.addEventListener("input", () => {
  query = searchInput.value;
  renderSongs();
});

sortToggle.addEventListener("click", () => {
  sortAscending = !sortAscending;
  sortLabel.textContent = sortAscending ? "Asc" : "Desc";
  sortToggle.setAttribute("aria-pressed", String(!sortAscending));
  renderGroups();
  renderSongs();
});

document.querySelector("#reset-demo").addEventListener("click", () => {
  const state = loadState(currentLevel);
  Object.keys(state).forEach((key) => delete state[key]);
  saveState();
  renderGroups();
  renderSongs();
});

function setProfileMenuOpen(open) {
  if (!profileMenuToggle || !profileDropdown) return;
  profileMenuToggle.setAttribute("aria-expanded", String(open));
  profileDropdown.hidden = !open;
}

profileMenuToggle?.addEventListener("click", (event) => {
  event.stopPropagation();
  setProfileMenuOpen(profileDropdown.hidden);
});

document.querySelector(".sync-actions")?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  if (button.dataset.action === "save-local") {
    saveCurrentLevelToLocalBackup();
  }

  if (button.dataset.action === "save-account") {
    showAccountSyncPlaceholder("save");
  }

  if (button.dataset.action === "load-local") {
    loadCurrentLevelFromLocalBackup();
  }

  if (button.dataset.action === "load-account") {
    showAccountSyncPlaceholder("load");
  }
});

profileDropdown?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-auth-action]");
  if (!button) return;

  setProfileMenuOpen(false);

  if (button.dataset.authAction === "login") {
    promptForUserId("login");
  }

  if (button.dataset.authAction === "register") {
    promptForUserId("register");
  }

  if (button.dataset.authAction === "logout") {
    logoutUser();
  }
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".profile-menu")) {
    setProfileMenuOpen(false);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    setProfileMenuOpen(false);
  }
});

document.querySelectorAll(".level-pill[data-level]").forEach((button) => {
  button.addEventListener("click", () => {
    const nextLevel = button.dataset.level;
    window.history.replaceState(null, "", `${window.location.pathname}?level=${nextLevel}`);
    loadLevel(nextLevel);
  });
});

loadLevel(currentLevel).catch((error) => {
  songList.textContent = `Failed to load diff/${currentLevel}.txt`;
  console.error(error);
});

updateProfileName();

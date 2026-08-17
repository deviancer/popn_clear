"use strict";

const SRAN_CONFIG = window.POPN_SUPABASE || {};
const { TABLE_IDS, STATUS_LABELS, parseSrandomText, recordStatus, remapRecordTable } =
  window.POPN_SRANDOM_DATA;
const {
  aggregateSummaries,
  changedSongs,
  countRecords,
  mergeRecords,
  sortSummaryRows,
} = window.POPN_SRANDOM_COMMUNITY_DATA;

let sranSupabase = null;
let activeTable = "all";
let loadToken = 0;
let authMode = "login";
let messageResolver = null;
let selectedPlayer = null;
let selectedDetailTable = "1";
const catalogs = {};
const authState = { user: null, profile: null };

const rankTableBody = document.querySelector("#rank-table-body");
const activityBox = document.querySelector("#activity-box");
const playerDetailPanel = document.querySelector("#player-detail-panel");
const profileName = document.querySelector("#lounge-profile-name");
const profileMenuToggle = document.querySelector("#profile-menu-toggle");
const profileDropdown = document.querySelector("#profile-dropdown");
const communitySubmit = document.querySelector("#community-submit");
const communityHide = document.querySelector("#community-hide");
const catalogTotal = document.querySelector("#catalog-total");
const authModal = document.querySelector("#auth-modal");
const authForm = document.querySelector("#auth-form");
const authModalTitle = document.querySelector("#auth-modal-title");
const authModalCopy = document.querySelector("#auth-modal-copy");
const authEmail = document.querySelector("#auth-email");
const authPassword = document.querySelector("#auth-password");
const authDisplayField = document.querySelector("#auth-display-field");
const authDisplayName = document.querySelector("#auth-display-name");
const authSubmit = document.querySelector("#auth-submit");
const messageModal = document.querySelector("#message-modal");
const messageModalTitle = document.querySelector("#message-modal-title");
const messageModalCopy = document.querySelector("#message-modal-copy");
const messageOk = document.querySelector("#message-ok");
const messageCancel = document.querySelector("#message-cancel");

const NETWORK_RETRY_MESSAGE = "网络加载失败，请检查网络，稍后重试。";
const REGISTER_NETWORK_RETRY_MESSAGE = "注册网络加载失败，请检查网络，稍后重试。";

function getSupabase() {
  if (sranSupabase) return sranSupabase;
  if (!SRAN_CONFIG.url || !SRAN_CONFIG.key || !window.supabase?.createClient) return null;
  sranSupabase = window.supabase.createClient(SRAN_CONFIG.url, SRAN_CONFIG.key);
  return sranSupabase;
}

function closeMessageModal(value = false) {
  messageModal.hidden = true;
  if (messageResolver) {
    messageResolver(value);
    messageResolver = null;
  }
}

function showMessage(message, { title = "提示", confirm = false } = {}) {
  if (!messageModal || !messageModalCopy || !messageOk || !messageCancel) {
    return Promise.resolve(confirm ? window.confirm(message) : (window.alert(message), true));
  }
  messageModalTitle.textContent = title;
  messageModalCopy.textContent = message;
  messageCancel.hidden = !confirm;
  messageModal.hidden = false;
  messageOk.focus();
  return new Promise((resolve) => {
    messageResolver = resolve;
  });
}

function showNotice(message, title = "提示") {
  return showMessage(message, { title });
}

function showConfirm(message, title = "确认") {
  return showMessage(message, { title, confirm: true });
}

function setProfileMenuOpen(open) {
  profileMenuToggle?.setAttribute("aria-expanded", String(open));
  if (profileDropdown) profileDropdown.hidden = !open;
}

function preferredDisplayName(user) {
  return (
    user?.user_metadata?.display_name ||
    user?.user_metadata?.name ||
    user?.user_metadata?.nickname ||
    user?.email?.split("@")[0] ||
    "player"
  );
}

function updateProfileName() {
  const signedIn = Boolean(authState.user);
  profileName.textContent = signedIn
    ? authState.profile?.display_name || preferredDisplayName(authState.user)
    : "guest";
  document
    .querySelectorAll('[data-auth-action="login"], [data-auth-action="register"]')
    .forEach((button) => button.toggleAttribute("hidden", signedIn));
  document.querySelector('[data-auth-action="logout"]')?.toggleAttribute("hidden", !signedIn);
}

function openAuthModal(mode) {
  authMode = mode;
  const isRegister = mode === "register";
  authModalTitle.textContent = isRegister ? "注册账号" : "登录";
  authModalCopy.textContent = isRegister
    ? "玩家 ID 不区分大小写且不能重复。注册后会立即登录，无需确认邮箱。"
    : "登录后可以合并并提交本机的全部 Sran 记录。";
  authSubmit.textContent = isRegister ? "注册" : "登录";
  authDisplayField.hidden = !isRegister;
  authDisplayName.required = isRegister;
  authPassword.autocomplete = isRegister ? "new-password" : "current-password";
  authForm.reset();
  if (authState.user?.email) authEmail.value = authState.user.email;
  authModal.hidden = false;
  authEmail.focus();
}

function closeAuthModal() {
  authModal.hidden = true;
}

function registrationErrorMessage(error) {
  const detail = `${error?.code || ""} ${error?.message || ""}`.toLowerCase();
  if (detail.includes("player_id_taken") || detail.includes("database error saving new user")) {
    return "注册失败：这个玩家 ID 已被使用，请换一个名称。玩家 ID 不区分大小写。";
  }
  if (detail.includes("already registered") || detail.includes("user_already_exists")) {
    return "这个邮箱已经注册过了，可以直接登录。";
  }
  return error?.message ? `注册失败：${error.message}` : REGISTER_NETWORK_RETRY_MESSAGE;
}

async function loadOrCreateProfile(defaultName = "") {
  const client = getSupabase();
  if (!client || !authState.user) return null;
  const resolvedName = defaultName || preferredDisplayName(authState.user);
  const { data, error } = await client
    .from("profiles")
    .select("id, display_name")
    .eq("id", authState.user.id)
    .maybeSingle();
  if (error) throw error;
  if (data) {
    authState.profile = data;
    updateProfileName();
    return data;
  }
  const { data: created, error: insertError } = await client
    .from("profiles")
    .insert({ id: authState.user.id, display_name: resolvedName })
    .select("id, display_name")
    .single();
  if (insertError) throw insertError;
  authState.profile = created;
  updateProfileName();
  return created;
}

async function syncAuthSession(session) {
  authState.user = session?.user || null;
  authState.profile = null;
  if (authState.user) {
    try {
      await loadOrCreateProfile();
    } catch (error) {
      console.error(error);
    }
  }
  updateProfileName();
}

async function loginWithEmail() {
  const client = getSupabase();
  if (!client) return showNotice(NETWORK_RETRY_MESSAGE);
  const { error } = await client.auth.signInWithPassword({
    email: authEmail.value.trim(),
    password: authPassword.value,
  });
  if (error) return showNotice(`登录失败：${error.message}`);
  closeAuthModal();
  return showNotice("登录成功。", "登录完成");
}

async function registerWithEmail() {
  const client = getSupabase();
  if (!client) return showNotice(REGISTER_NETWORK_RETRY_MESSAGE);
  const email = authEmail.value.trim();
  const displayName = authDisplayName.value.trim();
  if (!displayName) return showNotice("请输入玩家 ID。玩家 ID 不能只包含空格。");

  const { data: available, error: availabilityError } = await client.rpc("player_id_available", {
    candidate: displayName,
  });
  if (availabilityError) {
    console.error(availabilityError);
    return showNotice(REGISTER_NETWORK_RETRY_MESSAGE);
  }
  if (!available) return showNotice("这个玩家 ID 已被使用或格式不正确，请换一个名称。");

  const { data, error } = await client.auth.signUp({
    email,
    password: authPassword.value,
    options: { data: { display_name: displayName } },
  });
  if (error) return showNotice(registrationErrorMessage(error));

  closeAuthModal();
  if (data.session) {
    authState.user = data.user;
    try {
      await loadOrCreateProfile(displayName);
    } catch (profileError) {
      console.error(profileError);
    }
    return showNotice("注册成功，账号已经自动登录。", "注册完成");
  }
  return showNotice("注册成功。现在可以直接使用邮箱和密码登录。", "注册完成");
}

async function logoutUser() {
  const client = getSupabase();
  if (!client) return;
  const { error } = await client.auth.signOut();
  if (error) return showNotice(`退出失败：${error.message}`);
  authState.user = null;
  authState.profile = null;
  updateProfileName();
}

async function loadProfile() {
  const client = getSupabase();
  if (!client) return updateProfileName();
  const { data } = await client.auth.getSession();
  await syncAuthSession(data.session);
  client.auth.onAuthStateChange((_event, session) => syncAuthSession(session));
}

function requireSignedIn() {
  if (authState.user) return true;
  showNotice("请先点击右上角 guest 登录或注册账号。");
  setProfileMenuOpen(true);
  return false;
}

function storageKey(table) {
  return `popn_clear_sran${table}`;
}

function readLocalRecords(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch (error) {
    console.error(error);
    return {};
  }
}

function loadLocalRecords(table) {
  const current = readLocalRecords(storageKey(table));
  if (table !== "5") return current;

  const legacy = remapRecordTable(readLocalRecords(storageKey("0")), "0", "5");
  const migrated = { ...legacy, ...current };
  if (Object.keys(legacy).length) saveLocalRecords("5", migrated);
  return migrated;
}

function saveLocalRecords(table, records) {
  localStorage.setItem(storageKey(table), JSON.stringify(records));
}

async function loadCatalog(table) {
  if (catalogs[table]) return catalogs[table];
  const response = await fetch(`./diff/Sran${table}.txt`, { cache: "no-store" });
  if (!response.ok) throw new Error(`diff/Sran${table}.txt 读取失败`);
  catalogs[table] = parseSrandomText(await response.text(), table);
  return catalogs[table];
}

async function loadAllCatalogs() {
  const loaded = await Promise.all(TABLE_IDS.map(loadCatalog));
  if (catalogTotal) {
    catalogTotal.textContent = String(loaded.reduce((sum, catalog) => sum + catalog.songs.length, 0));
  }
  return loaded;
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function rateClass(rate) {
  if (rate >= 90) return "high";
  if (rate >= 70) return "mid";
  return "low";
}

function renderRankMessage(message, loading = false) {
  rankTableBody.replaceChildren();
  const row = document.createElement("tr");
  const cell = document.createElement("td");
  cell.colSpan = 10;
  if (loading) {
    cell.innerHTML = '<span class="loading-line"><span class="loading-spinner"></span>加载中...</span>';
  } else {
    cell.textContent = message;
  }
  row.append(cell);
  rankTableBody.append(row);
}

function renderRankRows(rows) {
  rankTableBody.replaceChildren();
  if (!rows.length) {
    const label = activeTable === "all" ? "Sran交流室" : `Sran${activeTable}`;
    renderRankMessage(`${label} 还没有玩家提交数据。`);
    return;
  }

  rows.forEach((row) => {
    const cleared = (row.easy_clear_count || 0) + (row.clear_count || 0);
    const clearRate = row.total_count ? (cleared / row.total_count) * 100 : 0;
    const unplayed = Math.max(0, row.total_count - cleared - row.fail_count);
    const tableCount = row.table_count || 1;
    const range = activeTable === "all" ? "Sran1–5" : `Sran${activeTable}`;
    const element = document.createElement("tr");
    element.className = "rank-row";
    element.innerHTML = `
      <td><strong></strong></td>
      <td><span class="sran-range-chip">${range}</span></td>
      <td class="sran-count-easy">${row.easy_clear_count || 0}</td>
      <td class="sran-count-clear">${row.clear_count || 0}</td>
      <td class="sran-count-fail">${row.fail_count || 0}</td>
      <td>${unplayed}</td>
      <td><span class="sran-coverage-chip${tableCount === 5 ? " complete" : ""}">${tableCount}/5</span></td>
      <td><span class="rate-pill ${rateClass(clearRate)}">${clearRate.toFixed(1)}%</span></td>
      <td>${formatDateTime(row.updated_at)}</td>
      <td><button class="detail-button" type="button">查看</button></td>
    `;
    element.querySelector("strong").textContent = row.display_name || "player";
    const openDetail = () => {
      rankTableBody.querySelectorAll(".rank-row").forEach((item) => item.classList.remove("selected"));
      element.classList.add("selected");
      showPlayerDetail(row);
    };
    element.addEventListener("click", openDetail);
    element.querySelector(".detail-button").addEventListener("click", (event) => {
      event.stopPropagation();
      openDetail();
    });
    rankTableBody.append(element);
  });
}

function renderActivityRows(rows) {
  activityBox.replaceChildren();
  if (!rows.length) {
    const empty = document.createElement("p");
    empty.textContent = "还没有 Sran 成绩动态。";
    activityBox.append(empty);
    return;
  }
  rows.forEach((row) => {
    const item = document.createElement("p");
    const table = document.createElement("span");
    table.className = "sran-activity-table";
    table.textContent = `Sran${row.table_id}`;
    const name = document.createElement("strong");
    name.textContent = row.display_name || "player";
    item.append(table, name, ` 在 ${formatDateTime(row.created_at)} ${row.message || "更新了记录。"}`);
    activityBox.append(item);
  });
}

function renderActivityLoading() {
  activityBox.replaceChildren();
  const item = document.createElement("p");
  item.innerHTML = '<span class="loading-line"><span class="loading-spinner"></span>加载中...</span>';
  activityBox.append(item);
}

function renderPlayerDetailEmpty(message = "点击排行榜里的玩家，可以查看对方 Sran1–5 的逐曲记录。") {
  selectedPlayer = null;
  playerDetailPanel.replaceChildren();
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "S-RANDOM dossier";
  const title = document.createElement("h2");
  title.textContent = "玩家 Sran 档案";
  const empty = document.createElement("p");
  empty.className = "detail-empty";
  empty.textContent = message;
  playerDetailPanel.append(eyebrow, title, empty);
}

function appendDetailMetric(parent, label, value) {
  const item = document.createElement("div");
  const strong = document.createElement("strong");
  const span = document.createElement("span");
  strong.textContent = value;
  span.textContent = label;
  item.append(strong, span);
  parent.append(item);
}

function renderDetailSongList(catalog, records) {
  const list = document.createElement("div");
  list.className = "sran-detail-list";
  catalog.groups.forEach((group) => {
    const songs = catalog.songs.filter((song) => song.sranDifficulty === group);
    const section = document.createElement("section");
    section.className = "sran-detail-group";
    const heading = document.createElement("div");
    heading.className = "sran-detail-group-heading";
    const groupName = document.createElement("span");
    groupName.textContent = group;
    const groupCounts = countRecords(records, { songs });
    const groupProgress = document.createElement("span");
    groupProgress.textContent = `${groupCounts.easyClear + groupCounts.clear}/${songs.length} CLEAR`;
    heading.append(groupName, groupProgress);
    section.append(heading);

    songs.forEach((song) => {
      const status = recordStatus(records, song);
      const row = document.createElement("article");
      row.className = `sran-detail-song status-${status || "unplayed"}`;
      const marker = document.createElement("span");
      marker.className = "sran-detail-status";
      marker.textContent = STATUS_LABELS[status];
      const body = document.createElement("div");
      body.className = "sran-detail-song-body";
      const genre = document.createElement("strong");
      genre.textContent = song.genre;
      const difficulty = document.createElement("span");
      difficulty.textContent = song.sranDifficulty;
      body.append(genre, difficulty);
      const level = document.createElement("span");
      level.className = "sran-detail-level";
      level.textContent = `Lv${song.level}`;
      row.append(marker, body, level);
      section.append(row);
    });
    list.append(section);
  });
  return list;
}

function renderPlayerDetail(player) {
  selectedPlayer = player;
  const { row, recordsByTable } = player;
  const tableCounts = {};
  TABLE_IDS.forEach((table) => {
    tableCounts[table] = countRecords(recordsByTable[table] || {}, catalogs[table]);
  });
  const overall = TABLE_IDS.reduce(
    (total, table) => {
      const counts = tableCounts[table];
      total.total += counts.total;
      total.easyClear += counts.easyClear;
      total.clear += counts.clear;
      total.fail += counts.fail;
      total.unplayed += counts.unplayed;
      return total;
    },
    { total: 0, easyClear: 0, clear: 0, fail: 0, unplayed: 0 },
  );
  const cleared = overall.easyClear + overall.clear;
  const clearRate = overall.total ? (cleared / overall.total) * 100 : 0;

  playerDetailPanel.replaceChildren();
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "Sran1–5 player dossier";
  const title = document.createElement("h2");
  title.textContent = row.display_name || "player";
  const updated = document.createElement("p");
  updated.className = "detail-updated sran-detail-updated";
  updated.textContent = `最近更新：${formatDateTime(row.updated_at)}`;

  const summary = document.createElement("div");
  summary.className = "detail-summary";
  const meter = document.createElement("div");
  meter.className = "detail-meter";
  const fill = document.createElement("span");
  fill.style.width = `${clearRate}%`;
  meter.append(fill);
  const metrics = document.createElement("div");
  metrics.className = "detail-metrics";
  appendDetailMetric(metrics, "easy-clear", overall.easyClear);
  appendDetailMetric(metrics, "clear", overall.clear);
  appendDetailMetric(metrics, "fail", overall.fail);
  appendDetailMetric(metrics, "未游玩", overall.unplayed);
  appendDetailMetric(metrics, "完成率", `${clearRate.toFixed(1)}%`);
  summary.append(meter, metrics);

  const tabs = document.createElement("div");
  tabs.className = "sran-detail-table-tabs";
  TABLE_IDS.forEach((table) => {
    const button = document.createElement("button");
    button.type = "button";
    button.classList.toggle("active", table === selectedDetailTable);
    const label = document.createElement("strong");
    label.textContent = `Sran${table}`;
    const progress = document.createElement("span");
    progress.textContent = `${tableCounts[table].clear}/${tableCounts[table].total}`;
    button.append(label, progress);
    button.addEventListener("click", () => {
      selectedDetailTable = table;
      renderPlayerDetail(player);
    });
    tabs.append(button);
  });

  playerDetailPanel.append(
    eyebrow,
    title,
    updated,
    summary,
    tabs,
    renderDetailSongList(catalogs[selectedDetailTable], recordsByTable[selectedDetailTable] || {}),
  );
}

async function showPlayerDetail(row) {
  const client = getSupabase();
  if (!client || !row?.user_id) return renderPlayerDetailEmpty("暂时读取不到这位玩家的详细数据。");
  selectedDetailTable = activeTable === "all" ? "1" : activeTable;
  renderPlayerDetailEmpty("正在加载玩家的五张 Sran 表……");
  try {
    await loadAllCatalogs();
    const { data, error } = await client
      .from("srandom_records")
      .select("table_id, records, updated_at")
      .eq("user_id", row.user_id)
      .order("table_id", { ascending: true });
    if (error) throw error;
    const recordsByTable = Object.fromEntries(TABLE_IDS.map((table) => [table, {}]));
    (data || []).forEach((recordRow) => {
      recordsByTable[String(recordRow.table_id)] = recordRow.records || {};
    });
    renderPlayerDetail({ row, recordsByTable });
  } catch (error) {
    console.error(error);
    renderPlayerDetailEmpty("读取玩家 Sran 档案失败，请稍后重试。");
  }
}

async function loadLoungeData() {
  const currentToken = ++loadToken;
  renderRankMessage("", true);
  renderActivityLoading();
  const client = getSupabase();
  if (!client) {
    renderRankMessage("Sran交流室还没有玩家提交数据。");
    renderActivityRows([]);
    return;
  }

  const [summaryResult, activityResult] = await Promise.all([
    client
      .from("srandom_summaries")
      .select("user_id, display_name, table_id, total_count, easy_clear_count, clear_count, fail_count, updated_at")
      .order("clear_count", { ascending: false })
      .limit(1000),
    client
      .from("srandom_activity_logs")
      .select("display_name, table_id, message, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  if (currentToken !== loadToken) return;

  if (summaryResult.error) {
    console.error(summaryResult.error);
    renderRankMessage("读取 Sran 排行榜失败，请稍后重试。");
  } else {
    const summaries = summaryResult.data || [];
    const coverageByUser = new Map();
    summaries.forEach((row) => {
      coverageByUser.set(row.user_id, (coverageByUser.get(row.user_id) || 0) + 1);
    });
    const rows =
      activeTable === "all"
        ? aggregateSummaries(summaries)
        : sortSummaryRows(summaries.filter((row) => String(row.table_id) === activeTable)).map((row) => ({
            ...row,
            table_count: coverageByUser.get(row.user_id) || 1,
          }));
    renderRankRows(rows);
  }

  if (activityResult.error) {
    console.error(activityResult.error);
    renderActivityRows([]);
  } else {
    renderActivityRows(activityResult.data || []);
  }
}

function buildActivityMessage(previousSummary, counts, changes, easyClearAdds, clearAdds) {
  if (!previousSummary) {
    return `首次公开记录：EASY-CLEAR ${counts.easyClear}，CLEAR ${counts.clear}，FAIL ${counts.fail}。`;
  }
  const parts = [`变更 ${changes.length} 首`];
  if (easyClearAdds.length) parts.push(`新增 EASY-CLEAR ${easyClearAdds.length} 首`);
  if (clearAdds.length) parts.push(`新增 CLEAR ${clearAdds.length} 首`);
  return `更新记录：${parts.join("，")}。`;
}

async function submitAllSrandomRecords() {
  const client = getSupabase();
  if (!client) return showNotice(NETWORK_RETRY_MESSAGE);
  if (!requireSignedIn()) return;
  const confirmed = await showConfirm(
    "将合并本机与账号中的 Sran1–5 记录，并把五张表的汇总发布到 Sran交流室。本机已有状态优先，账号中仅云端存在的记录会保留。",
  );
  if (!confirmed) return;

  communitySubmit.disabled = true;
  communitySubmit.textContent = "提交中...";
  try {
    await loadAllCatalogs();
    const userId = authState.user.id;
    const displayName = authState.profile?.display_name || preferredDisplayName(authState.user);
    const [recordResult, summaryResult] = await Promise.all([
      client.from("srandom_records").select("table_id, records").eq("user_id", userId),
      client
        .from("srandom_summaries")
        .select("table_id, easy_clear_count, clear_count, fail_count")
        .eq("user_id", userId),
    ]);
    if (recordResult.error) throw recordResult.error;
    if (summaryResult.error) throw summaryResult.error;

    const cloudRows = new Map((recordResult.data || []).map((row) => [String(row.table_id), row]));
    const previousSummaries = new Map((summaryResult.data || []).map((row) => [String(row.table_id), row]));
    const recordUpserts = [];
    const summaryUpserts = [];
    const activityInserts = [];
    const updatedAt = new Date().toISOString();
    let changedTableCount = 0;
    let changedSongCount = 0;
    let addedEasyClearCount = 0;
    let addedClearCount = 0;

    TABLE_IDS.forEach((table) => {
      const catalog = catalogs[table];
      const cloudRow = cloudRows.get(table);
      const previousSummary = previousSummaries.get(table);
      const merged = mergeRecords(cloudRow?.records || {}, loadLocalRecords(table), catalog);
      const changes = changedSongs(cloudRow?.records || {}, merged, catalog);
      const easyClearAdds = changes.filter(
        (song) =>
          recordStatus(cloudRow?.records || {}, song) !== "easy-clear" &&
          recordStatus(merged, song) === "easy-clear",
      );
      const clearAdds = changes.filter(
        (song) => recordStatus(cloudRow?.records || {}, song) !== "clear" && recordStatus(merged, song) === "clear",
      );
      const counts = countRecords(merged, catalog);
      saveLocalRecords(table, merged);

      if (!cloudRow || changes.length) {
        recordUpserts.push({
          user_id: userId,
          table_id: Number(table),
          records: merged,
          updated_at: updatedAt,
        });
      }

      if (!previousSummary || changes.length) {
        summaryUpserts.push({
          user_id: userId,
          table_id: Number(table),
          display_name: displayName,
          total_count: counts.total,
          easy_clear_count: counts.easyClear,
          clear_count: counts.clear,
          fail_count: counts.fail,
          updated_at: updatedAt,
        });
      }

      if (changes.length || (!previousSummary && counts.easyClear + counts.clear + counts.fail > 0)) {
        activityInserts.push({
          user_id: userId,
          display_name: displayName,
          table_id: Number(table),
          message: buildActivityMessage(previousSummary, counts, changes, easyClearAdds, clearAdds),
        });
      }

      if (changes.length) {
        changedTableCount += 1;
        changedSongCount += changes.length;
        addedEasyClearCount += easyClearAdds.length;
        addedClearCount += clearAdds.length;
      }
    });

    if (recordUpserts.length) {
      const { error } = await client.from("srandom_records").upsert(recordUpserts, {
        onConflict: "user_id,table_id",
      });
      if (error) throw error;
    }
    if (summaryUpserts.length) {
      const { error } = await client.from("srandom_summaries").upsert(summaryUpserts, {
        onConflict: "user_id,table_id",
      });
      if (error) throw error;
    }
    if (activityInserts.length) {
      const { error } = await client.from("srandom_activity_logs").insert(activityInserts);
      if (error) throw error;
    }

    await loadLoungeData();
    if (changedTableCount) {
      await showNotice(
        `Sran1–5 提交成功：更新 ${changedTableCount} 张表、${changedSongCount} 首记录，新增 EASY-CLEAR ${addedEasyClearCount} 首、新增 CLEAR ${addedClearCount} 首。`,
        "提交完成",
      );
    } else if (summaryUpserts.length) {
      await showNotice("五张 Sran 表已首次发布，当前没有发现本机与账号记录差异。", "提交完成");
    } else {
      await showNotice("同步完成，没有发现 Sran 记录变化；排行更新时间和动态均未刷新。", "无需更新");
    }
  } catch (error) {
    console.error(error);
    await showNotice("提交失败，请检查网络或数据库迁移状态后重试。");
  } finally {
    communitySubmit.disabled = false;
    communitySubmit.textContent = "提交全部 Sran 记录";
  }
}

async function hideOwnSrandomData() {
  const client = getSupabase();
  if (!client) return showNotice(NETWORK_RETRY_MESSAGE);
  if (!requireSignedIn()) return;
  const confirmed = await showConfirm(
    "隐藏后，你的 Sran 排行、动态和逐曲详情会从交流室消失；账号中的原始记录仍会保留，之后可再次提交恢复。",
  );
  if (!confirmed) return;

  communityHide.disabled = true;
  communityHide.textContent = "隐藏中...";
  try {
    const userId = authState.user.id;
    const { error: summaryError } = await client.from("srandom_summaries").delete().eq("user_id", userId);
    if (summaryError) throw summaryError;
    const { error: activityError } = await client.from("srandom_activity_logs").delete().eq("user_id", userId);
    if (activityError) throw activityError;
    renderPlayerDetailEmpty();
    await loadLoungeData();
    await showNotice("你的 Sran 公开数据已隐藏，账号原始记录仍然保留。", "隐藏完成");
  } catch (error) {
    console.error(error);
    await showNotice("隐藏失败，请检查网络后稍后重试。");
  } finally {
    communityHide.disabled = false;
    communityHide.textContent = "隐藏我的 Sran 数据";
  }
}

document.querySelectorAll("[data-table]").forEach((button) => {
  button.addEventListener("click", () => {
    activeTable = button.dataset.table === "all" || TABLE_IDS.includes(button.dataset.table)
      ? button.dataset.table
      : "all";
    document
      .querySelectorAll("[data-table]")
      .forEach((item) => item.classList.toggle("active", item.dataset.table === activeTable));
    renderPlayerDetailEmpty(
      activeTable === "all"
        ? "选择总排行玩家，查看对方 Sran1–5 的逐曲记录。"
        : `选择 Sran${activeTable} 排行玩家，查看对方完整的五张 Sran 表。`,
    );
    loadLoungeData();
  });
});

profileMenuToggle?.addEventListener("click", (event) => {
  event.stopPropagation();
  setProfileMenuOpen(profileDropdown.hidden);
});

profileDropdown?.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-auth-action]");
  if (!button) return;
  setProfileMenuOpen(false);
  if (button.dataset.authAction === "login") openAuthModal("login");
  if (button.dataset.authAction === "register") openAuthModal("register");
  if (button.dataset.authAction === "logout") await logoutUser();
});

authForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (authMode === "register") await registerWithEmail();
  else await loginWithEmail();
});

document.querySelectorAll('[data-modal-close="auth"]').forEach((button) => {
  button.addEventListener("click", closeAuthModal);
});
document.querySelectorAll('[data-modal-close="message"]').forEach((button) => {
  button.addEventListener("click", () => closeMessageModal(false));
});
messageOk?.addEventListener("click", () => closeMessageModal(true));
messageCancel?.addEventListener("click", () => closeMessageModal(false));
communitySubmit?.addEventListener("click", submitAllSrandomRecords);
communityHide?.addEventListener("click", hideOwnSrandomData);

document.addEventListener("click", (event) => {
  if (!event.target.closest(".profile-menu")) setProfileMenuOpen(false);
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  setProfileMenuOpen(false);
  if (!authModal?.hidden) closeAuthModal();
  if (!messageModal?.hidden) closeMessageModal(false);
});

loadAllCatalogs().catch(console.error);
loadProfile();
loadLoungeData();

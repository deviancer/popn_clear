const LOUNGE_LEVELS = ["46", "47", "48", "49", "50"];
const LOUNGE_CONFIG = window.POPN_SUPABASE || {};
const LOUNGE_MAJOR_ORDER = ["入門", "逆詐称", "弱", "中", "強", "詐称", "別格", "未定"];
const DETAIL_KIND_ORDER = {
  perfect: 0,
  fc: 1,
  clear: 2,
  fail: 3,
  blank: 4,
};
const DETAIL_DIFFICULTY_ORDER = ["詐称", "強", "中", "弱", "逆詐称", "入門", "別格", "未定"];
const DETAIL_KIND_LABELS = {
  fail: "fail",
  clear: "clear",
  fc: "full combo",
  perfect: "perfect",
  blank: "未记录",
};

let loungeSupabase = null;
let activeLoungeLevel = "46";
const songCatalogByLevel = {};

const rankTableBody = document.querySelector("#rank-table-body");
const activityBox = document.querySelector("#activity-box");
const playerDetailPanel = document.querySelector("#player-detail-panel");
const loungeProfileName = document.querySelector("#lounge-profile-name");
const communitySubmit = document.querySelector("#community-submit");
const communityHide = document.querySelector("#community-hide");
const profileMenuToggle = document.querySelector("#profile-menu-toggle");
const profileDropdown = document.querySelector("#profile-dropdown");
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

let authMode = "login";
let messageResolver = null;
let loungeLoadToken = 0;
const loungeAuthState = {
  user: null,
  profile: null,
};
const NETWORK_RETRY_MESSAGE = "网络加载失败，请检查网络，稍后重试。";
const REGISTER_NETWORK_RETRY_MESSAGE = "注册网络加载失败，请检查网络，稍后重试。";

function getLoungeSupabase() {
  if (loungeSupabase) return loungeSupabase;
  if (!LOUNGE_CONFIG.url || !LOUNGE_CONFIG.key || !window.supabase?.createClient) return null;
  loungeSupabase = window.supabase.createClient(LOUNGE_CONFIG.url, LOUNGE_CONFIG.key);
  return loungeSupabase;
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
  if (!profileMenuToggle || !profileDropdown) return;
  profileMenuToggle.setAttribute("aria-expanded", String(open));
  profileDropdown.hidden = !open;
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

function updateLoungeProfileName() {
  const signedIn = Boolean(loungeAuthState.user);
  loungeProfileName.textContent = signedIn
    ? loungeAuthState.profile?.display_name || preferredDisplayName(loungeAuthState.user)
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
    ? "创建账号后，可以从点灯页上传记录到交流室。"
    : "登录后可以查看账号状态，并在点灯页同步记录。";
  authSubmit.textContent = isRegister ? "注册" : "登录";
  authDisplayField.hidden = !isRegister;
  authDisplayName.required = isRegister;
  authPassword.autocomplete = isRegister ? "new-password" : "current-password";
  authForm.reset();

  if (loungeAuthState.user?.email) authEmail.value = loungeAuthState.user.email;
  authModal.hidden = false;
  authEmail.focus();
}

function closeAuthModal() {
  authModal.hidden = true;
}

async function loadOrCreateProfile(defaultName = "") {
  const client = getLoungeSupabase();
  if (!client || !loungeAuthState.user) return null;
  const resolvedName = defaultName || preferredDisplayName(loungeAuthState.user);

  const { data, error } = await client
    .from("profiles")
    .select("id, display_name")
    .eq("id", loungeAuthState.user.id)
    .maybeSingle();

  if (error) throw error;
  if (data) {
    const fallbackName = loungeAuthState.user.email?.split("@")[0];
    const shouldRefreshName =
      resolvedName &&
      data.display_name !== resolvedName &&
      (!data.display_name || data.display_name === fallbackName || data.display_name === "player");

    if (shouldRefreshName) {
      const { data: updatedProfile, error: updateError } = await client
        .from("profiles")
        .update({ display_name: resolvedName, updated_at: new Date().toISOString() })
        .eq("id", loungeAuthState.user.id)
        .select("id, display_name")
        .single();

      if (updateError) throw updateError;
      loungeAuthState.profile = updatedProfile;
      updateLoungeProfileName();
      return updatedProfile;
    }

    loungeAuthState.profile = data;
    updateLoungeProfileName();
    return data;
  }

  const displayName = resolvedName;
  const { data: createdProfile, error: insertError } = await client
    .from("profiles")
    .insert({ id: loungeAuthState.user.id, display_name: displayName })
    .select("id, display_name")
    .single();

  if (insertError) throw insertError;
  loungeAuthState.profile = createdProfile;
  updateLoungeProfileName();
  return createdProfile;
}

async function syncAuthSession(session) {
  loungeAuthState.user = session?.user || null;
  loungeAuthState.profile = null;

  if (loungeAuthState.user) {
    try {
      await loadOrCreateProfile();
    } catch (error) {
      console.error(error);
    }
  }

  updateLoungeProfileName();
}

async function loginWithEmail() {
  const client = getLoungeSupabase();
  if (!client) {
    await showNotice(NETWORK_RETRY_MESSAGE);
    return;
  }

  const { error } = await client.auth.signInWithPassword({
    email: authEmail.value.trim(),
    password: authPassword.value,
  });

  if (error) {
    await showNotice(`登录失败：${error.message}`);
    return;
  }

  closeAuthModal();
  await showNotice("登录成功。");
}

async function registerWithEmail() {
  const client = getLoungeSupabase();
  if (!client) {
    await showNotice(REGISTER_NETWORK_RETRY_MESSAGE);
    return;
  }

  const email = authEmail.value.trim();
  const displayName = authDisplayName.value.trim() || email.split("@")[0];
  const redirectUrl = new URL("./confirm.html", window.location.href);
  const { data, error } = await client.auth.signUp({
    email,
    password: authPassword.value,
    options: {
      emailRedirectTo: redirectUrl.toString(),
      data: { display_name: displayName },
    },
  });

  if (error) {
    await showNotice(REGISTER_NETWORK_RETRY_MESSAGE);
    return;
  }

  closeAuthModal();
  if (data.session) {
    loungeAuthState.user = data.user;
    try {
      await loadOrCreateProfile(displayName);
    } catch (profileError) {
      console.error(profileError);
    }
    await showNotice("注册成功，已登录。");
  } else {
    await showNotice("注册成功。请按邮箱确认后再登录。");
  }
}

async function logoutUser() {
  const client = getLoungeSupabase();
  if (!client) return;

  const { error } = await client.auth.signOut();
  if (error) {
    await showNotice(`退出失败：${error.message}`);
    return;
  }

  loungeAuthState.user = null;
  loungeAuthState.profile = null;
  updateLoungeProfileName();
}

function loadLocalState(level) {
  try {
    return JSON.parse(localStorage.getItem(`popn_clear_lv${level}`) || "{}");
  } catch (error) {
    console.error(error);
    return {};
  }
}

function parseSongCatalog(text, level) {
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
      return {
        id: `${level}-${index}-${(genre || title || "").trim()}`,
        level,
        version: cleanBracket(versionRaw),
        licensed: /\[版\]/.test(licensedRaw || ""),
        genre: (genre || "").trim(),
        title: (title || "").trim(),
        bpm: (bpm || "").trim(),
        time: (time || "").trim(),
        notes: Number((notesRaw || "").replace(/[^\d]/g, "")) || 0,
        difficulty,
        group: parseDifficultyMajor(difficulty),
      };
    });
}

function cleanBracket(value = "") {
  return value.trim().replace(/^\[/, "").replace(/\]$/, "");
}

function parseDifficultyMajor(difficulty) {
  const trimmed = difficulty.trim();
  return LOUNGE_MAJOR_ORDER.find((name) => trimmed.startsWith(name)) || "未定";
}

async function loadSongCatalog(level) {
  if (songCatalogByLevel[level]) return songCatalogByLevel[level];
  const response = await fetch(`./diff/${level}.txt`, { cache: "no-store" });
  if (!response.ok) throw new Error(`diff/${level}.txt 读取失败`);
  songCatalogByLevel[level] = parseSongCatalog(await response.text(), level);
  return songCatalogByLevel[level];
}

function normalizeRecord(record) {
  if (record.clear === "failed") record.clear = "fail";
  if (record.clear === "normal" || record.clear === "easy") record.clear = "clear";
}

function recordKind(record) {
  if (!record?.clear) return "blank";
  if (record.clear === "fc" || record.clear === "perfect" || record.clear === "fail") return record.clear;
  return "clear";
}

function detailDifficultyRank(group) {
  const rank = DETAIL_DIFFICULTY_ORDER.indexOf(group);
  return rank === -1 ? DETAIL_DIFFICULTY_ORDER.length : rank;
}

function compareDetailSongs(records) {
  return (a, b) => {
    const recordA = { ...(records[a.id] || {}) };
    const recordB = { ...(records[b.id] || {}) };
    normalizeRecord(recordA);
    normalizeRecord(recordB);

    const kindRank =
      (DETAIL_KIND_ORDER[recordKind(recordA)] ?? DETAIL_KIND_ORDER.blank) -
      (DETAIL_KIND_ORDER[recordKind(recordB)] ?? DETAIL_KIND_ORDER.blank);
    if (kindRank) return kindRank;

    const groupRank = detailDifficultyRank(a.group) - detailDifficultyRank(b.group);
    if (groupRank) return groupRank;

    return (b.notes || 0) - (a.notes || 0) || a.title.localeCompare(b.title, "ja");
  };
}

function buildLevelPayload(level, songCatalog) {
  const records = loadLocalState(level);
  const counts = { fail: 0, clear: 0, fc: 0, perfect: 0, blank: 0 };

  songCatalog.forEach((song) => {
    const record = records[song.id] || {};
    normalizeRecord(record);
    counts[recordKind(record)] += 1;
  });

  return {
    level,
    total: songCatalog.length,
    clear: counts.clear + counts.fc + counts.perfect,
    fail: counts.fail,
    fullCombo: counts.fc,
    perfect: counts.perfect,
    records,
    updatedAt: new Date().toISOString(),
  };
}

function isClearKind(kind) {
  return kind === "clear" || kind === "fc" || kind === "perfect";
}

function clearSongChanges(previousRecords = {}, nextRecords = {}, songCatalog = []) {
  return songCatalog.filter((song) => {
    const previousRecord = previousRecords[song.id] || {};
    const nextRecord = nextRecords[song.id] || {};
    normalizeRecord(previousRecord);
    normalizeRecord(nextRecord);
    return !isClearKind(recordKind(previousRecord)) && isClearKind(recordKind(nextRecord));
  });
}

function formatClearSongPreview(clearSongs) {
  if (!clearSongs.length) return "";
  const preview = clearSongs.slice(0, 5).map((song) => `${song.genre} / ${song.title}`);
  const rest = clearSongs.length - preview.length;
  return rest > 0 ? `${preview.join("、")}，另 ${rest} 首` : preview.join("、");
}

function buildActivityMessageV2(previousSummary, payload, displayName, clearSongs = []) {
  const clearPreview = formatClearSongPreview(clearSongs);
  const suffix = clearPreview ? `\n本次 clear：${clearPreview}` : "";

  if (!previousSummary) {
    return `${displayName} 首次提交了 Lv${payload.level} 点灯记录，clear 总数 ${payload.clear}。${suffix}`;
  }

  const clearDelta = payload.clear - (previousSummary.clear_count || 0);
  const fcDelta = payload.fullCombo - (previousSummary.fc_count || 0);
  const perfectDelta = payload.perfect - (previousSummary.perfect_count || 0);
  const deltas = [];

  if (clearDelta > 0) deltas.push(`新增 clear ${clearDelta} 首`);
  if (fcDelta > 0) deltas.push(`新增 full combo ${fcDelta} 首`);
  if (perfectDelta > 0) deltas.push(`新增 perfect ${perfectDelta} 首`);

  return `${displayName} 更新了 Lv${payload.level} 数据，${deltas.length ? deltas.join("，") : `clear 总数 ${payload.clear}`}。${suffix}`;
}

function requireSignedIn() {
  if (loungeAuthState.user) return true;
  showNotice("请先点击右上角 guest 登录或注册账号。");
  setProfileMenuOpen(true);
  return false;
}

async function submitAllLocalRecords() {
  const client = getLoungeSupabase();
  if (!client) {
    await showNotice(NETWORK_RETRY_MESSAGE);
    return;
  }
  if (!requireSignedIn()) return;

  const confirmed = await showConfirm("将上传本机 Lv46-50 的点灯记录到交流室，并覆盖账号里已有的对应等级记录。");
  if (!confirmed) return;

  communitySubmit.disabled = true;
  communitySubmit.textContent = "提交中...";

  try {
    const userId = loungeAuthState.user.id;
    const displayName = loungeAuthState.profile?.display_name || loungeAuthState.user.email || "player";
    const summaries = [];
    const logs = [];
    let totalClearDelta = 0;
    let totalFcDelta = 0;
    let totalPerfectDelta = 0;

    for (const level of LOUNGE_LEVELS) {
      const songCatalog = await loadSongCatalog(level);
      const payload = buildLevelPayload(level, songCatalog);
      const { data: previousSummary, error: previousError } = await client
        .from("level_summaries")
        .select("clear_count, fc_count, perfect_count")
        .eq("user_id", userId)
        .eq("level", Number(level))
        .maybeSingle();

      if (previousError) throw previousError;

      const { data: previousRecordRow, error: previousRecordError } = await client
        .from("level_records")
        .select("records")
        .eq("user_id", userId)
        .eq("level", Number(level))
        .maybeSingle();

      if (previousRecordError) throw previousRecordError;

      const clearSongs = clearSongChanges(previousRecordRow?.records || {}, payload.records, songCatalog);

      totalClearDelta += Math.max(0, payload.clear - (previousSummary?.clear_count || 0));
      totalFcDelta += Math.max(0, payload.fullCombo - (previousSummary?.fc_count || 0));
      totalPerfectDelta += Math.max(0, payload.perfect - (previousSummary?.perfect_count || 0));

      const { error: recordError } = await client.from("level_records").upsert(
        {
          user_id: userId,
          level: Number(level),
          records: payload.records,
          updated_at: payload.updatedAt,
        },
        { onConflict: "user_id,level" },
      );
      if (recordError) throw recordError;

      summaries.push({
        user_id: userId,
        level: Number(level),
        display_name: displayName,
        total_count: payload.total,
        fail_count: payload.fail,
        clear_count: payload.clear,
        medal_count: Object.values(payload.records).filter((record) => record?.medal).length,
        fc_count: payload.fullCombo,
        perfect_count: payload.perfect,
        updated_at: payload.updatedAt,
      });

      logs.push({
        user_id: userId,
        display_name: displayName,
        level: Number(level),
        message: buildActivityMessageV2(previousSummary, payload, displayName, clearSongs),
      });
    }

    const { error: summaryError } = await client.from("level_summaries").upsert(summaries, {
      onConflict: "user_id,level",
    });
    if (summaryError) throw summaryError;

    const { error: logError } = await client.from("activity_logs").insert(logs);
    if (logError) throw logError;

    await loadLoungeData();
    await showNotice(
      `Lv46-50 上传成功。\n新增 clear ${totalClearDelta} 首，新增 full combo ${totalFcDelta} 首，新增 perfect ${totalPerfectDelta} 首。`,
      "提交完成",
    );
  } catch (error) {
    console.error(error);
    await showNotice("提交失败，请检查网络后稍后重试。");
  } finally {
    communitySubmit.disabled = false;
    communitySubmit.textContent = "提交当前数据";
  }
}

async function hideOwnCommunityData() {
  const client = getLoungeSupabase();
  if (!client) {
    await showNotice(NETWORK_RETRY_MESSAGE);
    return;
  }
  if (!requireSignedIn()) return;

  const confirmed = await showConfirm(
    "隐藏自己提交的所有成绩，从交流室中消失，假如想要恢复，请再点击 提交当前数据",
  );
  if (!confirmed) return;

  communityHide.disabled = true;
  communityHide.textContent = "隐藏中...";

  try {
    const userId = loungeAuthState.user.id;
    const { error: summaryError } = await client.from("level_summaries").delete().eq("user_id", userId);
    if (summaryError) throw summaryError;

    const { error: activityError } = await client.from("activity_logs").delete().eq("user_id", userId);
    if (activityError) throw activityError;

    await loadLoungeData();
    await showNotice("已隐藏你在交流室提交的数据。", "隐藏完成");
  } catch (error) {
    console.error(error);
    await showNotice("隐藏失败，请检查网络后稍后重试。");
  } finally {
    communityHide.disabled = false;
    communityHide.textContent = "隐藏我的数据";
  }
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

function detailCounts(records, songCatalog) {
  const counts = { fail: 0, clear: 0, fc: 0, perfect: 0, blank: 0 };
  songCatalog.forEach((song) => {
    const record = records[song.id] || {};
    normalizeRecord(record);
    counts[recordKind(record)] += 1;
  });
  return counts;
}

function renderPlayerDetailEmpty(message = "点击排行榜里的玩家，可以查看这个 Lv 的详细攻略情况。") {
  if (!playerDetailPanel) return;
  playerDetailPanel.replaceChildren();
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "player dossier";
  const title = document.createElement("h2");
  title.textContent = "玩家档案";
  const empty = document.createElement("p");
  empty.className = "detail-empty";
  empty.textContent = message;
  playerDetailPanel.append(eyebrow, title, empty);
}

function renderPlayerDetailLoading(row) {
  if (!playerDetailPanel) return;
  playerDetailPanel.replaceChildren();
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = `Lv${row.level} dossier`;
  const title = document.createElement("h2");
  title.textContent = row.display_name || "player";
  const loading = document.createElement("p");
  loading.className = "detail-empty";
  loading.innerHTML = `<span class="loading-line"><span class="loading-spinner"></span>加载玩家档案...</span>`;
  playerDetailPanel.append(eyebrow, title, loading);
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

function createDetailSongRow(song, record) {
  const normalized = { ...(record || {}) };
  normalizeRecord(normalized);
  const kind = recordKind(normalized);
  const row = document.createElement("article");
  row.className = `detail-song detail-${kind}`;

  const marker = document.createElement("span");
  marker.className = "detail-song-kind";
  marker.textContent = DETAIL_KIND_LABELS[kind] || kind;

  const body = document.createElement("div");
  body.className = "detail-song-body";
  const title = document.createElement("strong");
  title.textContent = `${song.genre} / ${song.title}`;
  const meta = document.createElement("span");
  meta.textContent = `${song.difficulty} · ${song.notes || "-"} notes`;
  body.append(title, meta);

  const extras = document.createElement("div");
  extras.className = "detail-song-extras";
  if (normalized.medal) {
    const medal = document.createElement("img");
    medal.src = `./icon/${normalized.medal}.png`;
    medal.alt = normalized.medal;
    extras.append(medal);
  }
  if (normalized.score) {
    const score = document.createElement("span");
    score.textContent = normalized.score;
    extras.append(score);
  }
  if (normalized.scoreRank) {
    const rank = document.createElement("img");
    rank.src = `./icon/${normalized.scoreRank === "s_7_failed" ? "s_7" : normalized.scoreRank}.png`;
    rank.alt = normalized.scoreRank;
    extras.append(rank);
  }

  row.append(marker, body, extras);
  return row;
}

function renderPlayerDetail(row, records, songCatalog) {
  if (!playerDetailPanel) return;
  const counts = detailCounts(records, songCatalog);
  const cleared = counts.clear + counts.fc + counts.perfect;
  const clearRate = songCatalog.length ? (cleared / songCatalog.length) * 100 : 0;

  playerDetailPanel.replaceChildren();

  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = `Lv${row.level} player dossier`;
  const title = document.createElement("h2");
  title.textContent = row.display_name || "player";
  const updated = document.createElement("p");
  updated.className = "detail-updated";
  updated.textContent = `更新时间：${formatDateTime(row.updated_at)}`;

  const summary = document.createElement("div");
  summary.className = "detail-summary";
  const meter = document.createElement("div");
  meter.className = "detail-meter";
  const meterFill = document.createElement("span");
  meterFill.style.width = `${clearRate}%`;
  meter.append(meterFill);
  const metrics = document.createElement("div");
  metrics.className = "detail-metrics";
  appendDetailMetric(metrics, "clear", `${cleared}/${songCatalog.length}`);
  appendDetailMetric(metrics, "fail", counts.fail);
  appendDetailMetric(metrics, "fc", counts.fc);
  appendDetailMetric(metrics, "perfect", counts.perfect);
  summary.append(meter, metrics);

  const list = document.createElement("div");
  list.className = "detail-song-list";
  [...songCatalog].sort(compareDetailSongs(records)).forEach((song) => {
    list.append(createDetailSongRow(song, records[song.id] || {}));
  });

  playerDetailPanel.append(eyebrow, title, updated, summary, list);
}

async function showPlayerDetail(row) {
  const client = getLoungeSupabase();
  if (!client || !row?.user_id) {
    renderPlayerDetailEmpty("暂时读取不到这位玩家的详细数据。");
    return;
  }

  renderPlayerDetailLoading(row);

  try {
    const [songCatalog, recordResult] = await Promise.all([
      loadSongCatalog(String(row.level)),
      client
        .from("level_records")
        .select("records, updated_at")
        .eq("user_id", row.user_id)
        .eq("level", Number(row.level))
        .maybeSingle(),
    ]);

    if (recordResult.error) throw recordResult.error;
    renderPlayerDetail(
      { ...row, updated_at: recordResult.data?.updated_at || row.updated_at },
      recordResult.data?.records || {},
      songCatalog,
    );
  } catch (error) {
    console.error(error);
    renderPlayerDetailEmpty("读取玩家档案失败，请稍后重试。");
  }
}

function renderEmptyRank(message) {
  rankTableBody.replaceChildren();
  const row = document.createElement("tr");
  const cell = document.createElement("td");
  cell.colSpan = 10;
  cell.textContent = message;
  row.append(cell);
  rankTableBody.append(row);
}

function renderLoadingRank() {
  rankTableBody.replaceChildren();
  const row = document.createElement("tr");
  const cell = document.createElement("td");
  cell.colSpan = 10;
  cell.innerHTML = `<span class="loading-line"><span class="loading-spinner"></span>加载中...</span>`;
  row.append(cell);
  rankTableBody.append(row);
}

function renderRankRows(rows) {
  rankTableBody.replaceChildren();

  if (!rows.length) {
    renderEmptyRank(`Lv${activeLoungeLevel} 还没有玩家提交数据。`);
    return;
  }

  rows.forEach((row) => {
    const clearRate = row.total_count ? (row.clear_count / row.total_count) * 100 : 0;
    const element = document.createElement("tr");
    element.className = "rank-row";
    element.innerHTML = `
      <td><strong></strong></td>
      <td>${row.level}</td>
      <td>${row.total_count}</td>
      <td>${row.fail_count || 0}</td>
      <td>${row.clear_count}</td>
      <td>${row.fc_count}</td>
      <td>${row.perfect_count}</td>
      <td><span class="rate-pill ${rateClass(clearRate)}">${clearRate.toFixed(1)}%</span></td>
      <td>${formatDateTime(row.updated_at)}</td>
      <td><button class="detail-button" type="button">查看</button></td>
    `;
    element.querySelector("strong").textContent = row.display_name || "player";
    element.addEventListener("click", (event) => {
      if (event.target.closest("button")) event.stopPropagation();
      rankTableBody.querySelectorAll(".rank-row").forEach((item) => item.classList.remove("selected"));
      element.classList.add("selected");
      showPlayerDetail(row);
    });
    element.querySelector(".detail-button").addEventListener("click", (event) => {
      event.stopPropagation();
      rankTableBody.querySelectorAll(".rank-row").forEach((item) => item.classList.remove("selected"));
      element.classList.add("selected");
      showPlayerDetail(row);
    });
    rankTableBody.append(element);
  });
}

function renderActivityRows(rows) {
  activityBox.replaceChildren();

  if (!rows.length) {
    const empty = document.createElement("p");
    empty.textContent = "还没有消息数据。";
    activityBox.append(empty);
    return;
  }

  rows.forEach((row) => {
    const item = document.createElement("p");
    const name = document.createElement("strong");
    const message = row.message || "更新了数据。";
    const cleanedMessage = message.startsWith(row.display_name || "")
      ? message.slice((row.display_name || "").length).trim()
      : message;
    const messageLines = cleanedMessage.split("\n").filter(Boolean);
    name.textContent = row.display_name || "player";
    item.append(name, ` 在 ${formatDateTime(row.created_at)} ${messageLines.shift() || ""}`);
    messageLines.forEach((line) => {
      const detail = document.createElement("span");
      detail.className = "activity-clear-preview";
      detail.textContent = line;
      item.append(detail);
    });
    activityBox.append(item);
  });
}

function renderActivityLoading() {
  activityBox.replaceChildren();
  const item = document.createElement("p");
  item.className = "activity-loading";
  item.innerHTML = `<span class="loading-line"><span class="loading-spinner"></span>加载中...</span>`;
  activityBox.append(item);
}

async function loadLoungeData() {
  const loadToken = ++loungeLoadToken;
  renderLoadingRank();
  renderActivityLoading();

  const client = getLoungeSupabase();
  if (!client) {
    renderEmptyRank(`Lv${activeLoungeLevel} 还没有玩家提交数据。`);
    renderActivityRows([]);
    return;
  }

  const { data: summaries, error: summaryError } = await client
    .from("level_summaries")
    .select("user_id, display_name, level, total_count, fail_count, clear_count, fc_count, perfect_count, updated_at")
    .eq("level", Number(activeLoungeLevel))
    .order("clear_count", { ascending: false })
    .order("fc_count", { ascending: false })
    .order("perfect_count", { ascending: false })
    .limit(50);

  if (loadToken !== loungeLoadToken) return;

  if (summaryError) {
    console.error(summaryError);
    renderEmptyRank("读取排行榜失败，请检查网络后稍后重试。");
  } else {
    renderRankRows(summaries || []);
  }

  const { data: activities, error: activityError } = await client
    .from("activity_logs")
    .select("display_name, level, message, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (loadToken !== loungeLoadToken) return;

  if (activityError) {
    console.error(activityError);
    renderActivityRows([]);
  } else {
    renderActivityRows(activities || []);
  }
}

async function loadLoungeProfile() {
  const client = getLoungeSupabase();
  if (!client) {
    updateLoungeProfileName();
    return;
  }

  const { data } = await client.auth.getSession();
  await syncAuthSession(data.session);
  client.auth.onAuthStateChange((_event, session) => {
    syncAuthSession(session);
  });
}

document.querySelectorAll(".level-tabs button[data-level]").forEach((button) => {
  button.addEventListener("click", () => {
    activeLoungeLevel = LOUNGE_LEVELS.includes(button.dataset.level) ? button.dataset.level : "46";
    document
      .querySelectorAll(".level-tabs button[data-level]")
      .forEach((item) => item.classList.toggle("active", item.dataset.level === activeLoungeLevel));
    renderPlayerDetailEmpty(`选择 Lv${activeLoungeLevel} 的排行榜玩家查看详细攻略情况。`);
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

  if (button.dataset.authAction === "login") {
    openAuthModal("login");
  }

  if (button.dataset.authAction === "register") {
    openAuthModal("register");
  }

  if (button.dataset.authAction === "logout") {
    await logoutUser();
  }
});

authForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (authMode === "register") {
    await registerWithEmail();
  } else {
    await loginWithEmail();
  }
});

document.querySelectorAll('[data-modal-close="auth"]').forEach((button) => {
  button.addEventListener("click", closeAuthModal);
});

document.querySelectorAll('[data-modal-close="message"]').forEach((button) => {
  button.addEventListener("click", () => closeMessageModal(false));
});

messageOk?.addEventListener("click", () => closeMessageModal(true));
messageCancel?.addEventListener("click", () => closeMessageModal(false));

communitySubmit?.addEventListener("click", submitAllLocalRecords);
communityHide?.addEventListener("click", hideOwnCommunityData);

document.addEventListener("click", (event) => {
  if (!event.target.closest(".profile-menu")) {
    setProfileMenuOpen(false);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    setProfileMenuOpen(false);
    if (!authModal?.hidden) closeAuthModal();
    if (!messageModal?.hidden) closeMessageModal(false);
  }
});

loadLoungeProfile();
loadLoungeData();

if (new URLSearchParams(window.location.search).get("auth") === "confirmed") {
  showNotice("邮箱确认完成，可以登录并提交数据了。", "注册完成");
  const cleanUrl = new URL(window.location.href);
  cleanUrl.searchParams.delete("auth");
  window.history.replaceState(null, "", `${cleanUrl.pathname}${cleanUrl.search}`);
}

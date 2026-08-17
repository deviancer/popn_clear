(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.POPN_SRANDOM_DATA = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const TABLE_IDS = ["1", "2", "3", "4", "5"];
  const STATUS_ORDER = ["", "easy-clear", "clear", "fail"];
  const STATUS_LABELS = {
    "": "未游玩",
    "easy-clear": "EASY-CLEAR",
    clear: "CLEAR",
    fail: "FAIL",
  };

  function normalizeTableId(table) {
    const value = String(table);
    if (!TABLE_IDS.includes(value)) {
      throw new Error(`Unknown Srandom table: ${value}`);
    }
    return value;
  }

  function isGroupHeading(line, table) {
    if (table === "5") return /^[A-Z]級(?:強|弱)?$/.test(line);
    return /^■Lv\d+(?:強|弱)?$/.test(line);
  }

  function normalizeGenre(value) {
    return value.trim().replace(/\s+/g, " ");
  }

  function buildSongId(table, level, genre) {
    return `sran:v1:${table}:${level}:${encodeURIComponent(normalizeGenre(genre))}`;
  }

  function parseSrandomText(text, tableId) {
    const table = normalizeTableId(tableId);
    const groups = [];
    const songs = [];
    let currentGroup = "";

    String(text)
      .replace(/\r/g, "")
      .split("\n")
      .forEach((rawLine, sourceIndex) => {
        const line = rawLine.trim();
        if (!line) return;

        if (isGroupHeading(line, table)) {
          currentGroup = line;
          groups.push(line);
          return;
        }

        if (!currentGroup || !/^\d+\t/.test(rawLine)) return;
        const columns = rawLine.split("\t");
        const level = columns[0].trim();
        const genre = normalizeGenre(columns[1] || "");
        if (!/^\d+$/.test(level) || !genre) return;

        songs.push({
          id: buildSongId(table, level, genre),
          table,
          sranDifficulty: currentGroup,
          level,
          genre,
          sourceIndex,
        });
      });

    return { table, groups, songs };
  }

  function normalizeStatus(value) {
    return value === "easy-clear" || value === "clear" || value === "fail" ? value : "";
  }

  function remapRecordTable(records, fromTable, toTable) {
    const source = records && typeof records === "object" && !Array.isArray(records) ? records : {};
    const fromPrefix = `sran:v1:${fromTable}:`;
    const toPrefix = `sran:v1:${toTable}:`;
    const remapped = {};

    Object.entries(source).forEach(([key, value]) => {
      const nextKey = key.startsWith(fromPrefix) ? `${toPrefix}${key.slice(fromPrefix.length)}` : key;
      remapped[nextKey] = value;
    });

    return remapped;
  }

  function recordStatus(records, song) {
    const record = records?.[song.id];
    return normalizeStatus(typeof record === "string" ? record : record?.status);
  }

  function nextStatus(status) {
    const current = STATUS_ORDER.indexOf(normalizeStatus(status));
    return STATUS_ORDER[(current + 1) % STATUS_ORDER.length];
  }

  return {
    TABLE_IDS,
    STATUS_ORDER,
    STATUS_LABELS,
    buildSongId,
    nextStatus,
    normalizeStatus,
    parseSrandomText,
    recordStatus,
    remapRecordTable,
  };
});

(function (root, factory) {
  const api = factory(root?.POPN_SRANDOM_DATA);

  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./srandom-data.js"));
  }

  if (root) root.POPN_SRANDOM_COMMUNITY_DATA = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (srandomData) {
  "use strict";

  function sanitizeRecords(records, catalog) {
    const source = records && typeof records === "object" && !Array.isArray(records) ? records : {};
    const clean = {};

    catalog.songs.forEach((song) => {
      const status = srandomData.recordStatus(source, song);
      if (status) clean[song.id] = { status };
    });

    return clean;
  }

  function mergeRecords(cloudRecords, localRecords, catalog) {
    return {
      ...sanitizeRecords(cloudRecords, catalog),
      ...sanitizeRecords(localRecords, catalog),
    };
  }

  function countRecords(records, catalog) {
    const counts = { total: catalog.songs.length, clear: 0, fail: 0, unplayed: 0 };
    catalog.songs.forEach((song) => {
      const status = srandomData.recordStatus(records, song);
      counts[status || "unplayed"] += 1;
    });
    return counts;
  }

  function changedSongs(previousRecords, nextRecords, catalog) {
    return catalog.songs.filter(
      (song) =>
        srandomData.recordStatus(previousRecords, song) !==
        srandomData.recordStatus(nextRecords, song),
    );
  }

  function aggregateSummaries(rows) {
    const players = new Map();

    rows.forEach((row) => {
      const current = players.get(row.user_id) || {
        user_id: row.user_id,
        display_name: row.display_name || "player",
        table_id: "all",
        total_count: 0,
        clear_count: 0,
        fail_count: 0,
        table_count: 0,
        updated_at: null,
      };
      current.total_count += Number(row.total_count) || 0;
      current.clear_count += Number(row.clear_count) || 0;
      current.fail_count += Number(row.fail_count) || 0;
      current.table_count += 1;
      if (!current.updated_at || new Date(row.updated_at) > new Date(current.updated_at)) {
        current.updated_at = row.updated_at;
      }
      players.set(row.user_id, current);
    });

    return [...players.values()].sort(
      (a, b) =>
        b.clear_count - a.clear_count ||
        a.fail_count - b.fail_count ||
        new Date(b.updated_at) - new Date(a.updated_at),
    );
  }

  function sortSummaryRows(rows) {
    return [...rows].sort(
      (a, b) =>
        b.clear_count - a.clear_count ||
        a.fail_count - b.fail_count ||
        new Date(b.updated_at) - new Date(a.updated_at),
    );
  }

  return {
    aggregateSummaries,
    changedSongs,
    countRecords,
    mergeRecords,
    sanitizeRecords,
    sortSummaryRows,
  };
});

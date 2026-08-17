const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { parseSrandomText } = require("../srandom-data.js");
const {
  aggregateSummaries,
  changedSongs,
  countRecords,
  mergeRecords,
} = require("../srandom-community-data.js");

const catalog = parseSrandomText(
  fs.readFileSync(path.join(__dirname, "../diff/Sran0.txt"), "utf8"),
  "0",
);
const [first, second] = catalog.songs;
const cloud = {
  [first.id]: { status: "clear" },
  unknown: { status: "fail" },
};
const local = {
  [first.id]: { status: "fail" },
  [second.id]: { status: "clear" },
};
const merged = mergeRecords(cloud, local, catalog);

assert.deepEqual(merged[first.id], { status: "fail" }, "local status wins a conflict");
assert.deepEqual(merged[second.id], { status: "clear" }, "new local status is retained");
assert.equal(merged.unknown, undefined, "unknown song IDs are discarded");
assert.deepEqual(countRecords(merged, catalog), {
  total: 196,
  clear: 1,
  fail: 1,
  unplayed: 194,
});
assert.deepEqual(changedSongs(cloud, merged, catalog), [first, second]);

const aggregate = aggregateSummaries([
  {
    user_id: "a",
    display_name: "Alice",
    table_id: 0,
    total_count: 196,
    clear_count: 10,
    fail_count: 2,
    updated_at: "2026-08-16T00:00:00Z",
  },
  {
    user_id: "a",
    display_name: "Alice",
    table_id: 1,
    total_count: 265,
    clear_count: 20,
    fail_count: 3,
    updated_at: "2026-08-17T00:00:00Z",
  },
  {
    user_id: "b",
    display_name: "Bob",
    table_id: 0,
    total_count: 196,
    clear_count: 25,
    fail_count: 1,
    updated_at: "2026-08-17T00:00:00Z",
  },
]);

assert.equal(aggregate[0].display_name, "Alice", "aggregate ranking uses total clear count");
assert.deepEqual(
  {
    total: aggregate[0].total_count,
    clear: aggregate[0].clear_count,
    fail: aggregate[0].fail_count,
    tables: aggregate[0].table_count,
  },
  { total: 461, clear: 30, fail: 5, tables: 2 },
);

const migration = fs.readFileSync(
  path.join(__dirname, "../supabase/migrations/202608170001_srandom_community.sql"),
  "utf8",
);
assert.match(migration, /alter table public\.srandom_records enable row level security/i);
assert.match(migration, /published srandom records or owner are readable/i);
assert.match(migration, /revoke all on table public\.srandom_records/i);

console.log("Srandom community aggregation, merge rules, and migration guardrails verified.");

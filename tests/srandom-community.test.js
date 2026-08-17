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
  fs.readFileSync(path.join(__dirname, "../diff/Sran5.txt"), "utf8"),
  "5",
);
const [first, second, third] = catalog.songs;
const cloud = {
  [first.id]: { status: "clear" },
  unknown: { status: "fail" },
};
const local = {
  [first.id]: { status: "fail" },
  [second.id]: { status: "easy-clear" },
  [third.id]: { status: "clear" },
};
const merged = mergeRecords(cloud, local, catalog);

assert.deepEqual(merged[first.id], { status: "fail" }, "local status wins a conflict");
assert.deepEqual(merged[second.id], { status: "easy-clear" }, "new local easy clear is retained");
assert.equal(merged.unknown, undefined, "unknown song IDs are discarded");
assert.deepEqual(countRecords(merged, catalog), {
  total: 196,
  easyClear: 1,
  clear: 1,
  fail: 1,
  unplayed: 193,
});
assert.deepEqual(changedSongs(cloud, merged, catalog), [first, second, third]);

const aggregate = aggregateSummaries([
  {
    user_id: "a",
    display_name: "Alice",
    table_id: 5,
    total_count: 196,
    easy_clear_count: 4,
    clear_count: 10,
    fail_count: 2,
    updated_at: "2026-08-16T00:00:00Z",
  },
  {
    user_id: "a",
    display_name: "Alice",
    table_id: 1,
    total_count: 265,
    easy_clear_count: 5,
    clear_count: 20,
    fail_count: 3,
    updated_at: "2026-08-17T00:00:00Z",
  },
  {
    user_id: "b",
    display_name: "Bob",
    table_id: 5,
    total_count: 196,
    easy_clear_count: 8,
    clear_count: 25,
    fail_count: 1,
    updated_at: "2026-08-17T00:00:00Z",
  },
]);

assert.equal(aggregate[0].display_name, "Alice", "aggregate ranking uses total clear count");
assert.deepEqual(
  {
    total: aggregate[0].total_count,
    easy: aggregate[0].easy_clear_count,
    clear: aggregate[0].clear_count,
    fail: aggregate[0].fail_count,
    tables: aggregate[0].table_count,
  },
  { total: 461, easy: 9, clear: 30, fail: 5, tables: 2 },
);

const migration = fs.readFileSync(
  path.join(__dirname, "../supabase/migrations/202608170001_srandom_community.sql"),
  "utf8",
);
assert.match(migration, /alter table public\.srandom_records enable row level security/i);
assert.match(migration, /published srandom records or owner are readable/i);
assert.match(migration, /revoke all on table public\.srandom_records/i);

const upgradeMigration = fs.readFileSync(
  path.join(__dirname, "../supabase/migrations/202608170002_srandom5_and_easy_clear.sql"),
  "utf8",
);
assert.match(upgradeMigration, /add column easy_clear_count/i);
assert.match(upgradeMigration, /set table_id = 5/i);
assert.match(upgradeMigration, /sran:v1:5:/i);
assert.match(upgradeMigration, /table_id between 1 and 5/i);

console.log("Srandom community aggregation, merge rules, and migration guardrails verified.");

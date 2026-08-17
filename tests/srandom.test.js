const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  TABLE_IDS,
  STATUS_LABELS,
  nextStatus,
  parseSrandomText,
  recordStatus,
  remapRecordTable,
} = require("../srandom-data.js");

const expected = {
  1: { songs: 265, groups: ["■Lv19", "■Lv18", "■Lv17", "■Lv16", "■Lv15", "■Lv14", "■Lv13", "■Lv12", "■Lv11"] },
  2: { songs: 353, groups: ["■Lv10", "■Lv9", "■Lv8", "■Lv7", "■Lv6", "■Lv5"] },
  3: { songs: 406, groups: ["■Lv4", "■Lv3", "■Lv2強", "■Lv2弱"] },
  4: { songs: 230, groups: ["■Lv1強", "■Lv1弱"] },
  5: { songs: 196, groups: ["A級", "B級強", "B級弱", "C級"] },
};

assert.deepEqual(TABLE_IDS, ["1", "2", "3", "4", "5"]);

Object.entries(expected).forEach(([table, expectation]) => {
  const text = fs.readFileSync(path.join(__dirname, `../diff/Sran${table}.txt`), "utf8");
  const catalog = parseSrandomText(text, table);
  assert.equal(catalog.songs.length, expectation.songs, `Sran${table} song count`);
  assert.deepEqual(catalog.groups, expectation.groups, `Sran${table} groups`);
  assert.equal(new Set(catalog.songs.map((song) => song.id)).size, catalog.songs.length, `Sran${table} ids`);
  catalog.songs.forEach((song) => {
    assert.ok(song.genre);
    assert.match(song.level, /^\d+$/);
    assert.ok(expectation.groups.includes(song.sranDifficulty));
  });
});

const sran5 = parseSrandomText(
  fs.readFileSync(path.join(__dirname, "../diff/Sran5.txt"), "utf8"),
  "5",
);
assert.deepEqual(
  { difficulty: sran5.songs[0].sranDifficulty, level: sran5.songs[0].level, genre: sran5.songs[0].genre },
  { difficulty: "A級", level: "46", genre: "ケシゴム(EX)" },
);
assert.equal(sran5.songs.some((song) => song.genre.includes("http")), false);

assert.equal(nextStatus(""), "easy-clear");
assert.equal(nextStatus("easy-clear"), "clear");
assert.equal(nextStatus("clear"), "fail");
assert.equal(nextStatus("fail"), "");
assert.equal(STATUS_LABELS[""], "未游玩");
assert.equal(STATUS_LABELS["easy-clear"], "EASY-CLEAR");
assert.equal(recordStatus({ [sran5.songs[0].id]: { status: "easy-clear" } }, sran5.songs[0]), "easy-clear");
assert.equal(recordStatus({ [sran5.songs[0].id]: { status: "perfect" } }, sran5.songs[0]), "");

const legacyId = sran5.songs[0].id.replace("sran:v1:5:", "sran:v1:0:");
const migrated = remapRecordTable({ [legacyId]: { status: "clear" } }, "0", "5");
assert.deepEqual(migrated[sran5.songs[0].id], { status: "clear" });

console.log("Srandom: all five catalogs parsed and status cycle verified.");

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  STATUS_LABELS,
  nextStatus,
  parseSrandomText,
  recordStatus,
} = require("../srandom-data.js");

const expected = {
  0: { songs: 196, groups: ["A級", "B級強", "B級弱", "C級"] },
  1: { songs: 265, groups: ["■Lv19", "■Lv18", "■Lv17", "■Lv16", "■Lv15", "■Lv14", "■Lv13", "■Lv12", "■Lv11"] },
  2: { songs: 353, groups: ["■Lv10", "■Lv9", "■Lv8", "■Lv7", "■Lv6", "■Lv5"] },
  3: { songs: 406, groups: ["■Lv4", "■Lv3", "■Lv2強", "■Lv2弱"] },
  4: { songs: 230, groups: ["■Lv1強", "■Lv1弱"] },
};

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

const sran0 = parseSrandomText(
  fs.readFileSync(path.join(__dirname, "../diff/Sran0.txt"), "utf8"),
  "0",
);
assert.deepEqual(
  { difficulty: sran0.songs[0].sranDifficulty, level: sran0.songs[0].level, genre: sran0.songs[0].genre },
  { difficulty: "A級", level: "46", genre: "ケシゴム(EX)" },
);
assert.equal(sran0.songs.some((song) => song.genre.includes("http")), false);

assert.equal(nextStatus(""), "clear");
assert.equal(nextStatus("clear"), "fail");
assert.equal(nextStatus("fail"), "");
assert.equal(STATUS_LABELS[""], "未游玩");
assert.equal(recordStatus({ [sran0.songs[0].id]: { status: "clear" } }, sran0.songs[0]), "clear");
assert.equal(recordStatus({ [sran0.songs[0].id]: { status: "perfect" } }, sran0.songs[0]), "");

console.log("Srandom: all five catalogs parsed and status cycle verified.");

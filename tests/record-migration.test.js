const fs = require("fs");
const vm = require("vm");

// Usage (PowerShell):
// git show HEAD:diff/46.txt | node tests/record-migration.test.js 46
const level = Number(process.argv[2]);
if (!level) throw new Error("Pass a level as the first argument.");

const publishedCatalogText = fs.readFileSync(0, "utf8");
const context = { window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync("record-identity.js", "utf8"), context);
const recordsApi = context.window.POPN_RECORDS;

function parseCatalog(text, attachPublishedAliases) {
  const songs = text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line, sourceIndex) => {
      const columns = line.split("\t");
      const fullFormat = columns.length >= 8;
      const genre = fullFormat ? columns[2] : columns[1];
      const title = fullFormat ? columns[3] : columns[2];
      return {
        level,
        sourceIndex,
        genre: (genre || "").trim(),
        title: (title || "").trim(),
      };
    });

  recordsApi.prepareSongCatalog(songs);
  return attachPublishedAliases ? recordsApi.attachPublishedLegacyIds(songs, level) : songs;
}

const publishedSongs = parseCatalog(publishedCatalogText, false);
const currentSongs = parseCatalog(fs.readFileSync(`diff/${level}.txt`, "utf8"), true);
const aliasOwners = new Map();

currentSongs.forEach((song) => {
  song.legacyIds.forEach((alias) => {
    if (aliasOwners.has(alias) && aliasOwners.get(alias) !== song.id) {
      throw new Error(`Duplicate alias: ${alias}`);
    }
    aliasOwners.set(alias, song.id);
  });
});

const publishedRecords = {
  [`future-unknown-${level}`]: { clear: "perfect", marker: "keep-me" },
};
publishedSongs.forEach((song, index) => {
  publishedRecords[song.currentLegacyId] = {
    clear: index % 2 ? "clear" : "fc",
    marker: `${level}:${index}`,
  };
});

const migrated = recordsApi.migrateRecords(publishedRecords, currentSongs).records;
publishedSongs.forEach((publishedSong) => {
  const matches = currentSongs.filter((song) => song.legacyIds.includes(publishedSong.currentLegacyId));
  if (matches.length !== 1) {
    throw new Error(`Published key mapped ${matches.length} times: ${publishedSong.currentLegacyId}`);
  }
  if (matches[0].id !== publishedSong.id) {
    throw new Error(`Published key mapped to the wrong chart: ${publishedSong.currentLegacyId}`);
  }
  const expected = publishedRecords[publishedSong.currentLegacyId].marker;
  const actual = recordsApi.resolveSongRecord(migrated, matches[0])?.marker;
  if (actual !== expected) throw new Error(`Record mismatch: ${expected} became ${actual}`);
});

if (migrated[`future-unknown-${level}`]?.marker !== "keep-me") {
  throw new Error("Migration deleted an unknown record key.");
}

const firstCurrentSong = currentSongs.find((song) => song.id === publishedSongs[0].id);
const remoteRecords = {
  [`remote-unknown-${level}`]: { medal: "x" },
  [publishedSongs[0].currentLegacyId]: { clear: "fail", medal: "remote" },
};
const localRecords = {
  [`local-unknown-${level}`]: { score: "99999" },
  [publishedSongs[0].currentLegacyId]: { clear: "perfect" },
};
const merged = recordsApi.mergeRecordMaps(remoteRecords, localRecords, currentSongs);
const firstRecord = recordsApi.resolveSongRecord(merged, firstCurrentSong);

if (firstRecord.clear !== "perfect" || firstRecord.medal !== "remote") {
  throw new Error(`Record fields did not merge correctly: ${JSON.stringify(firstRecord)}`);
}
if (!merged[`remote-unknown-${level}`] || !merged[`local-unknown-${level}`]) {
  throw new Error("Merge deleted an unknown record key.");
}

const staleStableWithOldClientEdit = {
  [firstCurrentSong.id]: { clear: "fail", score: "100" },
  [publishedSongs[0].currentLegacyId]: { clear: "perfect", score: "99999" },
};
const oldClientResult = recordsApi.resolveSongRecord(staleStableWithOldClientEdit, firstCurrentSong);
if (oldClientResult.clear !== "perfect" || oldClientResult.score !== "99999") {
  throw new Error("A cached old client's newer edit was hidden by its stale stable-key copy.");
}

console.log(
  `Lv${level}: ${publishedSongs.length}/${publishedSongs.length} published charts mapped; ` +
    `${currentSongs.length} current charts; unknown keys retained`,
);

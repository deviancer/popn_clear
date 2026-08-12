(function () {
  const STABLE_ID_PREFIX = "popn-v2";
  const UPPER_MARK = "Ⓤ";
  const LEGACY_CATALOG_VERSION = "2026-06-11";
  const LEGACY_NEW_SONG_INDICES = {
    46: [143, 148, 152, 154, 156],
    47: [99, 103, 106, 107, 109],
    48: [23, 86, 88],
    49: [45],
    50: [],
  };
  const LEGACY_ORDER_OVERRIDES = {
    46: { 51: 52, 52: 51 },
  };
  const LEGACY_GENRE_OVERRIDES = {
    46: {
      8: "ハイパージャパネスク(UPPER)(EX)", 12: "超中華流行歌曲(UPPER)(EX)", 14: "SESSION With You!(EX)",
      16: "BEEF(EX)", 30: "Megalara Garuda(UPPER)(H)", 35: "Come to Life(EX)",
      38: "スウィートフレンドシップ(UPPER)(EX)", 51: "Blind(EX)", 52: "Little Little Princess(EX)",
      54: "脳漿炸裂ガール(UPPER)(EX)", 57: "コンビニエンスドラマ(EX)", 59: "Welcome to pop'n fantasy(EX)",
      65: "ネリと琥珀糖(EX)", 77: "Crumble Soul(EX)", 80: "Cloud 9(EX)",
      81: "残酷な天使のテーゼ(UPPER)(EX)", 88: "アンデスヒーリング(UPPER)(EX)", 89: "GET WILD(UPPER)(EX)",
      97: "Butter-FLY(UPPER)(EX)", 101: "ランカーキラーガール(EX)", 110: "狂水一華(EX)",
      121: "BLSTR(EX)", 147: "ダークネス4(UPPER)(EX)", 161: "ギャラクティックマーチ(UPPER)(H)",
      166: "CARTOON☆RagHour(EX)", 169: "胸キュン☆マレット(UPPER)(EX)", 173: "星屑の夜果て(EX)",
      174: "曇天(UPPER)(EX)", 177: "Popperz Chronicle(UPPER)(H)", 178: "ドーナツホール(UPPER)(EX)",
      184: "SHION(VENUS mix)(EX)", 193: "High Gravity(EX)", 200: "Afterimage d'automne(EX)",
      203: "H@appy Fever Forever!!(EX)", 210: "マイアガル、マイオドル(EX)",
      215: "おたすけ！アン子ちゃん (シノビアンレディーのテーマ 弐)(EX)", 226: "リトルロック(UPPER)(EX)",
      260: "ボタン(EX)", 265: "Six String Proof(EX)",
      266: "おーまい！らぶりー！すうぃーてぃ！だーりん！(EX)", 272: "プロレタリア狂騒歌(EX)",
    },
    47: {
      19: "Jetcoaster Windy(EX)", 27: "Catch Our Fire!(EX)", 29: "BLAZE∞BREEZE(EX)", 30: "革命パッショネイト(EX)",
      42: "叛逆のディスパレート(EX)", 50: "Invisible Farewell(EX)", 65: "ハイパーロッケンローレ(UPPER)(EX)",
      97: "あさきのコラボロック(UPPER)(EX)", 120: "セツナトリップ(UPPER)(EX)",
      133: "SDVX REMIX SELECTION for pop'n music vol.01(EX)", 138: "千本桜(UPPER)(EX)",
      145: "エモクトロ(UPPER)(EX)", 152: "アンセムコア(UPPER)(H)", 154: "Visterhv(EX)",
      159: "一触即発☆禅ガール(UPPER)(EX)", 165: "NUスタイルロカビリー(UPPER)(EX)",
      171: "マダーロック(UPPER)(EX)", 175: "サムライスラッシュ(UPPER)(EX)",
      177: "放課後コンチェルティーノ～私だけの部室狂騒曲(EX)", 179: "ハイパンク(UPPER)(EX)",
      180: "エモーショナルデュオ(UPPER)(EX)", 191: "萌えおこしストラテジー(UPPER)(EX)",
      194: "ナンキョク(UPPER)(EX)", 210: "アジアンコンチェルトREMIX(UPPER)(EX)",
      212: "六花美人(EX)", 213: "焔華(EX)", 214: "元禄花吹雪(EX)",
      219: "virkatoの主題によるperson09風超絶技巧変奏曲(UPPER)(H)",
      223: "♥LOVE² シュガ→♥ (かめりあ&ななひら's Over-Sweet-Dempa ♥LOVE² シュガ→♥な恋愛教室 Remix)(EX)",
      228: "50th Memorial Songs -The BEMANI History-(EX)",
    },
    48: {
      0: "ネオクラシカル・ヘヴィメタル(UPPER)(EX)", 4: "Celsus II(EX)", 23: "ANNIVERSARY ∴∵∴ ←↓↑→(EX)",
      25: "少女と時の花(EX)", 33: "おしゃまスウィング(UPPER)(EX)", 39: "cucumis melo(EX)",
      43: "祭ノ痕、君ヲ憶フ。(EX)", 47: "Mirage Age(EX)", 48: "トランスコア(UPPER)(EX)",
      53: "Dracophobia(EX)", 57: "ドリームゲイザー(UPPER)(EX)", 61: "ティーラプソディ(UPPER)(EX)",
      66: "翠雨の祷(EX)", 75: "革命パッショネイト(UPPER)(EX)", 84: "ドラムンコアダスト2(UPPER)(EX)",
      92: "Gray clouds(EX)", 95: "Trill auf G(EX)", 104: "戦乙女ロック(UPPER)(EX)",
      123: "令和の国(EX)", 126: "ヴァイオリンプログレッシブ(UPPER)(EX)", 129: "ノスタルジア(UPPER)(EX)",
      132: "バイナリーpf(UPPER)(EX)", 134: "ラボテクノ(UPPER)(EX)", 143: "理系ポップ(UPPER)(EX)",
      144: "voltississimo(EX)", 154: "ポチコの幸せな日常 (狂犬U`x´UばうわうHARDCORE Remix)(EX)",
      155: "メイドメタル(UPPER)(EX)", 166: "プログレ(UPPER)(EX)", 174: "ヒップロック4(UPPER)(EX)",
      175: "多極性ニューロンの崩壊による人間の末路(EX)",
    },
    49: {
      0: "Last Twilight(EX)", 5: "Timepiece phase II(EX)", 9: "バトルダンス(UPPER)(EX)",
      10: "シュヴァルツァー(UPPER)(EX)", 22: "Lachryma《Re:Queen'M》(EX)", 25: "zeeros(EX)",
      37: "Festum Duodecimum!(EX)", 39: "Vinculum stellarum(EX)", 40: "ラメント(UPPER)(EX)",
      48: "レヴェラチューン(UPPER)(EX)", 61: "ΩVERSOUL(EX)", 62: "最小三倍完全数(EX)",
      63: "限界食堂(EX)", 74: "IDM(UPPER)(EX)", 79: "スイーツプログレッシヴ(UPPER)(EX)",
      84: "萌えおこし電波ソング(UPPER)(EX)", 88: "ギャラクティックマーチ(UPPER)(EX)", 92: "西馬込交通曲(EX)",
    },
    50: {},
  };

  function isPlainRecord(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function chartType(song) {
    return (song.genre.match(/\((EX|H|N|EASY)\)$/) || [])[1] || "UNKNOWN";
  }

  function isUpperChart(song) {
    return song.genre.includes("(UPPER)") || song.genre.includes(UPPER_MARK) || song.title.endsWith(UPPER_MARK);
  }

  function stableTitle(song) {
    const title = song.title.endsWith(UPPER_MARK) ? song.title.slice(0, -UPPER_MARK.length) : song.title;
    return title.normalize("NFKC").trim();
  }

  function stableSongId(song) {
    const variant = isUpperChart(song) ? "U" : "N";
    return `${STABLE_ID_PREFIX}:${song.level}:${variant}:${chartType(song)}:${encodeURIComponent(stableTitle(song))}`;
  }

  function legacySongId(song) {
    return `${song.level}-${song.sourceIndex}-${song.genre || song.title}`;
  }

  function prepareSongCatalog(songs) {
    const ids = new Set();
    songs.forEach((song) => {
      song.currentLegacyId = legacySongId(song);
      song.id = stableSongId(song);
      song.legacyIds = [song.currentLegacyId];
      if (ids.has(song.id)) throw new Error(`Duplicate stable song ID: ${song.id}`);
      ids.add(song.id);
    });
    return songs;
  }

  function attachPublishedLegacyIds(songs, level) {
    const excluded = new Set(LEGACY_NEW_SONG_INDICES[level] || []);
    const publishedSongs = songs.filter((song) => !excluded.has(song.sourceIndex));
    const orderOverrides = LEGACY_ORDER_OVERRIDES[level] || {};
    const genreOverrides = LEGACY_GENRE_OVERRIDES[level] || {};
    const legacyIds = new Set();

    publishedSongs.forEach((song, legacyIndex) => {
      const mappedIndex = orderOverrides[legacyIndex] ?? legacyIndex;
      const mappedSong = publishedSongs[mappedIndex];
      const legacyGenre = genreOverrides[legacyIndex] || mappedSong.genre;
      const legacyId = `${level}-${legacyIndex}-${legacyGenre || mappedSong.title}`;
      if (legacyIds.has(legacyId)) throw new Error(`Duplicate ${LEGACY_CATALOG_VERSION} legacy ID: ${legacyId}`);
      legacyIds.add(legacyId);
      if (!mappedSong.legacyIds.includes(legacyId)) mappedSong.legacyIds.unshift(legacyId);
    });

    return songs;
  }

  function linkLegacyCatalog(currentSongs, legacySongs) {
    const currentById = new Map(currentSongs.map((song) => [song.id, song]));
    legacySongs.forEach((legacySong) => {
      const currentSong = currentById.get(legacySong.id);
      if (!currentSong) return;
      const legacyId = legacySong.currentLegacyId;
      if (!currentSong.legacyIds.includes(legacyId)) currentSong.legacyIds.unshift(legacyId);
    });
    return currentSongs;
  }

  function resolveSongRecord(records, song) {
    let found = false;
    let merged = {};
    const aliases = song.legacyIds.filter((id) => id !== song.currentLegacyId);
    // The pre-migration published alias intentionally wins. A cached old page
    // may edit it while carrying stable/current aliases that it cannot update.
    [song.id, song.currentLegacyId, ...aliases].forEach((id) => {
      if (!isPlainRecord(records[id])) return;
      merged = { ...merged, ...records[id] };
      found = true;
    });
    return found ? merged : null;
  }

  function writeSongRecord(records, song, record) {
    const next = { ...(record || {}) };
    records[song.id] = { ...next };
    song.legacyIds.forEach((legacyId) => {
      records[legacyId] = { ...next };
    });
    return records[song.id];
  }

  function migrateRecords(records, songs) {
    const source = isPlainRecord(records) ? records : {};
    const migrated = { ...source };
    let migratedSongs = 0;

    songs.forEach((song) => {
      const record = resolveSongRecord(source, song);
      if (!record) return;
      const targetIds = [song.id, ...song.legacyIds];
      const changed = targetIds.some((id) => JSON.stringify(source[id] || null) !== JSON.stringify(record));
      writeSongRecord(migrated, song, record);
      if (changed) migratedSongs += 1;
    });

    return { records: migrated, migratedSongs };
  }

  function mergeRecordMaps(remoteRecords, localRecords, songs) {
    // Canonicalize each side before merging. This lets a record written by an
    // older client override the matching stable key when the local side is the
    // newer source, while still preserving every unknown key from both sides.
    const remote = migrateRecords(remoteRecords, songs).records;
    const local = migrateRecords(localRecords, songs).records;
    const merged = { ...remote };

    Object.entries(local).forEach(([id, record]) => {
      merged[id] = isPlainRecord(merged[id]) && isPlainRecord(record) ? { ...merged[id], ...record } : record;
    });

    return migrateRecords(merged, songs).records;
  }

  window.POPN_RECORDS = {
    attachPublishedLegacyIds,
    linkLegacyCatalog,
    mergeRecordMaps,
    migrateRecords,
    prepareSongCatalog,
    resolveSongRecord,
    stableSongId,
    writeSongRecord,
  };
})();

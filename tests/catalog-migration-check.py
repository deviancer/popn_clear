import re
import subprocess
import sys
from pathlib import Path


UPPER_MARK = "Ⓤ"

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def parse_catalog(text, level):
    songs = []
    for source_index, line in enumerate(line for line in text.splitlines() if line.strip()):
        columns = line.split("\t")
        full_format = len(columns) >= 8
        genre = columns[2] if full_format else columns[1]
        title = columns[3] if full_format else columns[2]
        genre = genre.strip()
        title = title.strip()
        chart_match = re.search(r"\((EX|H|N|EASY)\)$", genre)
        chart_type = chart_match.group(1) if chart_match else "UNKNOWN"
        variant = "U" if "(UPPER)" in genre or UPPER_MARK in genre or title.endswith(UPPER_MARK) else "N"
        stable_title = title.removesuffix(UPPER_MARK).strip()
        songs.append(
            {
                "source_index": source_index,
                "genre": genre,
                "title": title,
                "stable_id": (level, variant, chart_type, stable_title),
            }
        )
    return songs


def main():
    level = int(sys.argv[1])
    published_text = subprocess.run(
        ["git", "show", f"HEAD:diff/{level}.txt"],
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
    ).stdout
    current_text = Path(f"diff/{level}.txt").read_text(encoding="utf-8")
    published = parse_catalog(published_text, level)
    current = parse_catalog(current_text, level)
    published_ids = {song["stable_id"] for song in published}
    current_ids = {song["stable_id"] for song in current}

    missing = [song for song in published if song["stable_id"] not in current_ids]
    added = [song for song in current if song["stable_id"] not in published_ids]
    print(f"Lv{level}: published={len(published)} current={len(current)}")
    print("new current indices:", [song["source_index"] for song in added])
    for song in added:
        print(f"  + {song['source_index']}: {song['genre']} / {song['title']}")
    for song in missing:
        print(f"  ! missing old {song['source_index']}: {song['genre']} / {song['title']}")
    if missing:
        raise SystemExit(1)


if __name__ == "__main__":
    main()

import sys
import requests
import sqlite3
import re
import time
import random
from bs4 import BeautifulSoup

sys.stdout.reconfigure(encoding='utf-8')

BASE_URL   = "https://wiki.travellerrpg.com"
START_URL  = f"{BASE_URL}/Category:Systems"
HEADERS    = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
DB_FILE    = "traveller_systems.db"
TEST_MODE  = False    # set False to scrape all entries
TEST_LIMIT = 10


def fetch_page(url):
    response = requests.get(url, headers=HEADERS, timeout=15)
    response.raise_for_status()
    return BeautifulSoup(response.text, "html.parser")


def init_db(conn):
    conn.execute("""
        CREATE TABLE IF NOT EXISTS locations (
            id       INTEGER PRIMARY KEY AUTOINCREMENT,
            location TEXT UNIQUE
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS system_details (
            id                INTEGER PRIMARY KEY AUTOINCREMENT,
            system_name       TEXT,
            location_id       INTEGER,
            position          INTEGER,
            distance          REAL,
            distance_unit     TEXT,
            name              TEXT,
            uwp               TEXT,
            star_id           INTEGER,
            companion_star_id INTEGER,
            orbiting_world_id INTEGER,
            FOREIGN KEY (location_id)       REFERENCES locations(id),
            FOREIGN KEY (star_id)           REFERENCES stellar_details(id),
            FOREIGN KEY (companion_star_id) REFERENCES stellar_details(id),
            FOREIGN KEY (orbiting_world_id) REFERENCES system_details(id)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS stellar_details (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            system_name   TEXT,
            location_id   INTEGER,
            name          TEXT,
            type          TEXT,
            distance      REAL,
            distance_unit TEXT,
            FOREIGN KEY (location_id) REFERENCES locations(id)
        )
    """)
    conn.commit()


def get_or_create_location(conn, location):
    """Return the locations.id for the given string, inserting if new."""
    if not location:
        return None
    row = conn.execute(
        "SELECT id FROM locations WHERE location = ?", (location,)
    ).fetchone()
    if row:
        return row[0]
    cur = conn.execute("INSERT INTO locations (location) VALUES (?)", (location,))
    conn.commit()
    return cur.lastrowid


_STRIP_SYMBOLS = re.compile(r"[^a-zA-Z0-9 ./\-]")

def clean_value(val):
    """Return None for blank / ?? values, otherwise stripped string with symbols removed."""
    if val is None:
        return None
    v = val.strip()
    if v in ("", "??", "—", "-", "?"):
        return None
    return _STRIP_SYMBOLS.sub("", v).strip() or None


def is_numeric(s):
    """True if s can be parsed as a number (position is numeric = world row)."""
    try:
        float(s.strip())
        return True
    except (ValueError, AttributeError):
        return False


# Matches spectral-type strings: "F7 V", "K2 IV", "M0 Ia", "L7 V", or bare "BD"
_STELLAR_TYPE = re.compile(
    r'^([OBAFGKMLT]\d+(\.\d+)?\s+[IVXab]+|BD)',
    re.IGNORECASE
)

def is_stellar_type(s):
    """True if s looks like a stellar spectral type."""
    return bool(s and _STELLAR_TYPE.match(s.strip()))


def has_stellar_uwp(uwp_raw):
    """True if any slash-separated part of the UWP column is a spectral type."""
    if not uwp_raw:
        return False
    return any(is_stellar_type(part) for part in uwp_raw.split("/"))


def normalize_stellar_type(raw):
    """
    Clean a raw spectral type string scraped from the wiki:
      - Strips parenthetical annotations: "M9 V (Companion)" → "M9 V"
      - Reduces hyphenated luminosity classes: "F9 IV-V" → "F9 V"
      - Strips bare trailing noise: "M0 V Companion" → "M0 V"
    Must be called on the raw cell text BEFORE clean_value().
    """
    if not raw:
        return raw
    # Remove parenthetical blocks as a unit: "(Companion)", "(companion)", etc.
    s = re.sub(r'\s*\([^)]*\)', '', raw).strip()
    # Collapse hyphenated luminosity classes to the trailing part: IV-V → V
    s = re.sub(r'\b([IVX]+)-([IVX]+)\b', r'\2', s)
    # Insert space between digit and luminosity class if missing: "G2V" → "G2 V"
    s = re.sub(r'(\d)([IVX])', r'\1 \2', s)
    # Extract only the valid spectral type prefix, discarding trailing noise
    # like bare "Companion" that wasn't wrapped in parentheses.
    m = _STELLAR_TYPE.match(s.strip())
    if m:
        return m.group(0).strip()
    return s.strip() or None


_VALID_SPECIAL_TYPES = {'BD', 'D'}

def split_stellar_types(raw):
    """
    Split a type cell into individual spectral type strings.
    Handles slash/newline delimiters first, then falls back to
    regex extraction for space-joined entries like "G2 V G8 V".
    After a delimiter split, filters out fragments that contain no
    valid spectral type (e.g. a stray quote character rendered as a
    separate HTML element producing "'" as its own split part).
    """
    if not raw:
        return []
    if '/' in raw or '\n' in raw:
        parts = [p.strip() for p in re.split(r'[/\n]', raw) if p.strip()]
        valid = [
            p for p in parts
            if _STELLAR_TYPE.search(p) or normalize_stellar_type(p) in _VALID_SPECIAL_TYPES
        ]
        return valid if valid else [raw.strip()]   # fall back to whole string as one entry
    # No explicit delimiter — find all spectral type tokens in the string
    found = re.findall(r'[OBAFGKMLT]\d+(?:\.\d+)?\s+[IVXab]+|BD', raw, re.IGNORECASE)
    if len(found) > 1:
        return found
    return [raw.strip()] if raw.strip() else []


def extract_stellar_rows(system_name, name_raw, uwp_raw, distance=None, distance_unit=None):
    """
    Splits compound entries like name='Lusor/Speck', uwp='F7 V/BD' into
    individual stellar rows, pairing names with types by position.
    All stars on the same row share the same distance (e.g. a close pair).
    Primary stars have distance=NULL (no distance listed on the wiki row).
    """
    names = [n.strip() for n in re.split(r'[/\n&]', name_raw)
             if n.strip() and re.search(r'[a-zA-Z]', n)]
    types = split_stellar_types(uwp_raw or "")

    # types is authoritative: one entry per valid spectral type found.
    # Using max() would let stray name or type fragments create orphaned rows.
    results = []
    for i, raw_type in enumerate(types):
        star_name = clean_value(names[i]) if i < len(names) else None
        star_type = clean_value(normalize_stellar_type(raw_type))
        if star_name or star_type:
            results.append({
                "system_name":   system_name,
                "name":          star_name,
                "type":          star_type,
                "distance":      distance,
                "distance_unit": distance_unit,
            })
    return results


def extract_category_entries(soup):
    results = []
    pages_div = soup.find("div", id="mw-pages")
    if not pages_div:
        return results
    for a in pages_div.find_all("a"):
        name       = a.get_text(strip=True)
        href       = a.get("href", "")
        name_lower = name.lower()
        if "(system)" not in name_lower and "(world)" not in name_lower:
            continue
        if "/" in href.lstrip("/"):
            continue
        if "milieu" in name_lower:
            continue
        results.append({"name": name, "url": BASE_URL + href})
    return results


def next_page_url(soup):
    pages_div = soup.find("div", id="mw-pages")
    if not pages_div:
        return None
    for a in pages_div.find_all("a"):
        if "next page" in a.get_text(strip=True).lower():
            return BASE_URL + a["href"]
    return None


def scrape_system_page(url):
    """
    Returns (worlds, stars, location):
      worlds   -- list of world row dicts (no location key; resolved via location_id in main)
      stars    -- list of stellar row dicts
      location -- the location string for this system (e.g. "Rhylanor / Spinward Marches 2814")
    """
    soup     = fetch_page(url)
    worlds   = []
    stars    = []
    location = None

    for table in soup.find_all("table"):
        rows = table.find_all("tr")
        if len(rows) < 4:
            continue

        # Row 0: system name in a colspan=4 cell
        cells0 = rows[0].find_all("td")
        if not cells0 or cells0[0].get("colspan") != "4":
            continue

        system_name_raw = cells0[0].get_text(strip=True)
        system_name = re.sub(r'\[\d+\]', '', system_name_raw)
        system_name = re.sub(r'\s*[Ss]ystem\s*$', '', system_name).strip()

        # Row 1: location (subsector/sector + hex)
        cells1 = rows[1].find_all("td")
        if not cells1:
            continue
        location = cells1[0].get_text(separator=" ", strip=True)
        location = re.sub(r'(\D)(\d{4})$', r'\1 \2', location).strip()
        location = f"{system_name} / {location}"

        # Row 2: header -- must contain Position and UWP
        cells2 = rows[2].find_all("td")
        if len(cells2) < 4:
            continue
        header_text = " ".join(c.get_text(strip=True).lower() for c in cells2)
        if "position" not in header_text or "uwp" not in header_text:
            continue

        # Tracks which star(s) the current block of world rows orbits
        current_star_names = []

        # Data rows (row 3 onward)
        for row in rows[3:]:
            cells = row.find_all("td")
            n     = len(cells)
            if n < 3:
                continue

            pos_raw = cells[0].get_text(strip=True)

            if n == 3:
                # Star row layout: [position, name, type]  (no distance column)
                name_raw = cells[1].get_text(strip=True)
                uwp_raw  = cells[2].get_text(strip=True)
                dist_raw = ""
            else:
                # World row layout: [position, distance, name, uwp]
                dist_raw = cells[1].get_text(strip=True)
                name_raw = cells[2].get_text(strip=True)
                uwp_raw  = cells[3].get_text(strip=True)

            # Stellar rows: non-numeric position OR any UWP part is a spectral type
            if not is_numeric(pos_raw) or has_stellar_uwp(uwp_raw):
                # Re-extract with newline separator so <br>-separated multi-star
                # entries (e.g. "Noera\nSolox" / "M1 V\nM3 V") are splittable.
                if n == 3:
                    name_raw = cells[1].get_text(separator="\n", strip=True)
                    uwp_raw  = cells[2].get_text(separator="\n", strip=True)
                else:
                    name_raw = cells[2].get_text(separator="\n", strip=True)
                    uwp_raw  = cells[3].get_text(separator="\n", strip=True)

                # Update current star context -- split on / \n or &
                current_star_names = [
                    s for s in (clean_value(p) for p in re.split(r'[/\n&]', name_raw)) if s
                ]
                # Parse distance from dist_raw (same logic as world rows).
                # Primary stars have no distance cell (dist_raw="") → distance=NULL.
                star_dist_match = re.match(r'^([\d.]+)\s*([A-Za-z]+)?', dist_raw.strip())
                try:
                    star_distance      = float(star_dist_match.group(1)) if star_dist_match else None
                    star_distance_unit = (star_dist_match.group(2) or None) if star_dist_match else None
                except (ValueError, TypeError):
                    star_distance      = None
                    star_distance_unit = None
                stars.extend(extract_stellar_rows(
                    system_name, name_raw, uwp_raw, star_distance, star_distance_unit
                ))
                continue

            # World row
            pos_clean = clean_value(pos_raw)

            try:
                position = int(float(pos_clean)) if pos_clean else None
            except (ValueError, TypeError):
                position = None

            # Distance values carry units ("0.279 AU", "7 Diam") -- extract both
            dist_match = re.match(r'^([\d.]+)\s*([A-Za-z]+)?', dist_raw.strip())
            try:
                distance      = float(dist_match.group(1)) if dist_match else None
                distance_unit = dist_match.group(2) or None if dist_match else None
            except (ValueError, TypeError):
                distance      = None
                distance_unit = None

            # AU = orbiting a star; anything else = moon, normalised to "Diam"
            is_satellite = (distance_unit != "AU")
            if is_satellite and distance_unit != "Diam":
                distance_unit = "Diam"

            worlds.append({
                "system_name":         system_name,
                "position":            position,
                "distance":            distance,
                "distance_unit":       distance_unit,
                "is_satellite":        is_satellite,
                "name":                clean_value(name_raw),
                "uwp":                 clean_value(uwp_raw),
                "orbiting_star_name":  current_star_names[0] if current_star_names else None,
                "companion_star_name": current_star_names[1] if len(current_star_names) > 1 else None,
            })

    return worlds, stars, location


def print_table(conn, query, cols, widths, title):
    total_w = sum(widths) + 2 * (len(widths) - 1)
    print(f"\n{title}")
    print("=" * total_w)
    print("  ".join(f"{c:<{w}}" for c, w in zip(cols, widths)))
    print("-" * total_w)
    for row in conn.execute(query):
        print("  ".join(
            f"{str(v) if v is not None else 'NULL':<{w}}"
            for v, w in zip(row, widths)
        ))


def main():
    # -- Gather category links -----------------------------------------------
    all_entries = []
    url = START_URL
    while url:
        soup    = fetch_page(url)
        entries = extract_category_entries(soup)
        all_entries.extend(entries)
        url     = next_page_url(soup)

    if TEST_MODE:
        all_entries = all_entries[:TEST_LIMIT]
        print(f"TEST MODE -- processing first {TEST_LIMIT} entries\n")

    # -- Database setup (drop + recreate resets autoincrement counters) -------
    conn = sqlite3.connect(DB_FILE)
    conn.execute("PRAGMA foreign_keys = OFF")
    conn.execute("DROP TABLE IF EXISTS system_details")
    conn.execute("DROP TABLE IF EXISTS stellar_details")
    conn.execute("DROP TABLE IF EXISTS stellar")       # legacy name -- safe to remove
    conn.execute("DROP TABLE IF EXISTS locations")
    conn.execute("PRAGMA foreign_keys = ON")
    init_db(conn)

    # -- Scrape each system page ----------------------------------------------
    total_worlds = 0
    total_stars  = 0

    for entry in all_entries:
        print(f"Scraping: {entry['name']}")
        try:
            worlds, stars, location = scrape_system_page(entry["url"])
            location_id = get_or_create_location(conn, location)

            # Insert stellar rows first so we can resolve their IDs for world rows
            star_name_to_id = {}
            for row in stars:
                cur = conn.execute("""
                    INSERT INTO stellar_details
                        (system_name, location_id, name, type, distance, distance_unit)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (row["system_name"], location_id, row["name"], row["type"],
                      row.get("distance"), row.get("distance_unit")))
                if row["name"]:
                    star_name_to_id[row["name"]] = cur.lastrowid

            current_planet_id = None
            for row in worlds:
                is_satellite      = row["is_satellite"]
                star_id           = star_name_to_id.get(row["orbiting_star_name"])
                companion_star_id = star_name_to_id.get(row["companion_star_name"])
                orbiting_world_id = current_planet_id if is_satellite else None
                cur = conn.execute("""
                    INSERT INTO system_details
                        (system_name, location_id, position, distance, distance_unit,
                         name, uwp, star_id, companion_star_id, orbiting_world_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (row["system_name"], location_id, row["position"],
                      row["distance"], row["distance_unit"], row["name"], row["uwp"],
                      star_id, companion_star_id, orbiting_world_id))
                if not is_satellite:
                    current_planet_id = cur.lastrowid

            conn.commit()
            print(f"  {len(worlds)} world row(s),  {len(stars)} stellar row(s)  "
                  f"[location_id={location_id}]")
            total_worlds += len(worlds)
            total_stars  += len(stars)

        except Exception as e:
            print(f"  ERROR: {e}")

        # Polite delay -- randomised 1.5-3 s between requests
        time.sleep(random.uniform(1.5, 3.0))

    # -- Print results --------------------------------------------------------
    print(f"\nTotal world rows: {total_worlds}   Total stellar rows: {total_stars}")

    print_table(conn,
        """SELECT l.id, l.location FROM locations l ORDER BY l.id""",
        ["id", "location"],
        [4, 45],
        "LOCATIONS"
    )

    print_table(conn,
        """SELECT sd.id, sd.system_name, l.location, sd.position,
                  sd.distance, sd.distance_unit, sd.name, sd.uwp,
                  st1.name AS star, st2.name AS companion_star,
                  sd.orbiting_world_id
           FROM system_details sd
           LEFT JOIN locations l  ON sd.location_id       = l.id
           LEFT JOIN stellar_details  st1 ON sd.star_id           = st1.id
           LEFT JOIN stellar_details  st2 ON sd.companion_star_id = st2.id""",
        ["id", "system_name", "location", "position", "dist", "unit", "name", "uwp", "star", "companion", "moon_of"],
        [4, 14, 28, 8, 7, 5, 18, 12, 12, 12, 7],
        "\nSYSTEM DETAILS"
    )

    print_table(conn,
        """SELECT s.id, s.system_name, l.location, s.name, s.type
           FROM stellar_details s
           LEFT JOIN locations l ON s.location_id = l.id""",
        ["id", "system_name", "location", "name", "type"],
        [4, 16, 32, 28, 12],
        "\nSTELLAR"
    )

    conn.close()


if __name__ == "__main__":
    main()

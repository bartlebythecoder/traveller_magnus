"""
utilities/wiki_fetch.py

Fetch stage for the Traveller wiki snapshot (v0.19.0, manifest section 0.0.D). Run by the
developer when refreshing the snapshot (every 6-12 months); the app itself never contacts the
wiki.

    python utilities/wiki_fetch.py --dry-run        # what changed on the wiki; downloads nothing
    python utilities/wiki_fetch.py                  # download new and changed pages into raw/
    python utilities/wiki_fetch.py --prune          # ...and drop pages the wiki no longer has
    python utilities/wiki_fetch.py --travellermap   # refresh otu_systems/travellermap_mainworlds.json

A full refresh, in order:
    1. python utilities/wiki_fetch.py --dry-run     (look first)
    2. python utilities/wiki_fetch.py
    3. python utilities/wiki_parse.py               (read otu_systems/parse_report.md; fix with corrections/)
    4. python utilities/wiki_fetch.py --travellermap
    5. python utilities/wiki_parse.py               (again, with the fresh TravellerMap data)
    6. python utilities/wiki_build.py               (writes js/otu_system_data.js)

How it finds the pages: every main-namespace page that uses Template:InfoboxSystem (the template
also files them under Category:Systems). It compares each page's latest revision ID with
otu_systems/raw/index.json and downloads only pages that are new or changed, 50 per request.

Politeness: a generic User-Agent naming no person or project, a pause between requests,
maxlag=5 (the wiki can ask us to back off; we wait as long as it says), and retries with a
growing wait on network errors. Stage 1 (listing) is one request per 500 pages; stage 2
(downloading) one per 50 changed pages.

index.json: "fetched" is the snapshot date - it changes only when page content changes, so a
refresh that finds nothing new leaves the snapshot (and every loaded system's provenance)
alone. "checked" is the date of the last check, whatever it found.

All files are written with CRLF line endings (the repo is CRLF).
"""

import argparse
import datetime
import json
import os
import re
import sys
import time

try:
    import requests
except ImportError:
    print("This script needs the 'requests' package: python -m pip install requests")
    sys.exit(1)

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", "otu_systems"))
RAW_DIR = os.path.join(ROOT, "raw")
INDEX = os.path.join(RAW_DIR, "index.json")
CLEAN_DIR = os.path.join(ROOT, "clean")
TM_FILE = os.path.join(ROOT, "travellermap_mainworlds.json")

API = "https://wiki.travellerrpg.com/api.php"
TEMPLATE = "Template:InfoboxSystem"
TM_API = "https://travellermap.com/api"
HEADERS = {"User-Agent": "traveller-wiki-snapshot/1.0 (read-only, rate-limited; python-requests)"}
PAUSE = 2.0          # seconds between requests
BATCH = 50           # pages per content request (the MediaWiki limit for anonymous users)
MAX_TRIES = 5


def write_crlf(path, text):
    with open(path, "wb") as f:
        f.write(text.replace("\r\n", "\n").replace("\n", "\r\n").encode("utf-8"))


def file_name(title):
    """The raw/ file for a page: its title with characters Windows forbids replaced by '_'."""
    return re.sub(r'[\\/:*?"<>|]', "_", title) + ".wiki"


_last = [0.0]


def get(url, params, accept_json=True):
    """One polite GET: waits PAUSE since the last request, honours maxlag, retries."""
    params = dict(params)
    if url == API:
        params.setdefault("format", "json")
        params.setdefault("maxlag", 5)
    for attempt in range(1, MAX_TRIES + 1):
        wait = PAUSE - (time.time() - _last[0])
        if wait > 0:
            time.sleep(wait)
        _last[0] = time.time()
        try:
            r = requests.get(url, params=params, headers=HEADERS, timeout=60)
        except requests.RequestException as e:
            print(f"  network error ({e.__class__.__name__}), retry {attempt}/{MAX_TRIES}")
            time.sleep(PAUSE * attempt * 2)
            continue
        if r.status_code in (429, 503) or (accept_json and url == API and '"maxlag"' in r.text[:200]):
            delay = int(r.headers.get("Retry-After", "5") or 5)
            print(f"  the server asked us to wait ({r.status_code}); waiting {delay}s")
            time.sleep(max(delay, PAUSE))
            continue
        r.raise_for_status()
        return r.json() if accept_json else r.text
    raise RuntimeError(f"gave up after {MAX_TRIES} tries: {url} {params}")


def list_pages():
    """{title: {pageid, revid, timestamp}} for every main-namespace page using the template."""
    pages = {}
    cont = {}
    while True:
        d = get(API, dict(action="query", generator="embeddedin", geititle=TEMPLATE,
                          geinamespace=0, geilimit=500, prop="info", **cont))
        for p in (d.get("query", {}).get("pages") or {}).values():
            pages[p["title"]] = {"pageid": p["pageid"], "revid": p["lastrevid"],
                                 "timestamp": p.get("touched")}
        if "continue" in d:
            cont = {k: v for k, v in d["continue"].items() if k != "continue"}
        else:
            return pages


def fetch_content(titles):
    """{title: (pageid, revid, timestamp, wikitext)} for up to BATCH titles."""
    d = get(API, dict(action="query", prop="revisions", rvprop="ids|timestamp|content",
                      rvslots="main", titles="|".join(titles)))
    out = {}
    for p in (d.get("query", {}).get("pages") or {}).values():
        if "revisions" not in p:
            continue
        rev = p["revisions"][0]
        out[p["title"]] = (p["pageid"], rev["revid"], rev["timestamp"], rev["slots"]["main"]["*"])
    return out


def load_index():
    if not os.path.exists(INDEX):
        return {"fetched": None, "pages": {}}
    with open(INDEX, encoding="utf-8") as f:
        return json.load(f)


def save_index(idx):
    idx["pages"] = dict(sorted(idx["pages"].items()))
    ordered = {"fetched": idx.get("fetched"), "checked": idx.get("checked"), "pages": idx["pages"]}
    write_crlf(INDEX, json.dumps(ordered, indent=2, ensure_ascii=False) + "\n")


def refresh_wiki(dry_run, prune):
    today = datetime.date.today().isoformat()
    idx = load_index()
    have = idx["pages"]
    print(f"Listing pages that use {TEMPLATE} ...")
    live = list_pages()
    new = sorted(t for t in live if t not in have)
    changed = sorted(t for t in live if t in have and live[t]["revid"] != have[t].get("revid"))
    gone = sorted(t for t in have if t not in live)
    print(f"  on the wiki: {len(live)}   in raw/: {len(have)}")
    print(f"  new: {len(new)}   changed: {len(changed)}   no longer on the wiki: {len(gone)}")
    for label, items in (("NEW", new), ("CHANGED", changed), ("GONE", gone)):
        for t in items:
            extra = f"  rev {have[t].get('revid')} -> {live[t]['revid']}" if label == "CHANGED" else ""
            print(f"    {label:8} {t}{extra}")
    if dry_run:
        print("Dry run: nothing downloaded, nothing written.")
        return 0

    todo = new + changed
    got = differs = 0
    for i in range(0, len(todo), BATCH):
        batch = todo[i:i + BATCH]
        print(f"Downloading {i + 1}-{i + len(batch)} of {len(todo)} ...")
        for title, (pageid, revid, ts, text) in fetch_content(batch).items():
            fn = file_name(title)
            path = os.path.join(RAW_DIR, fn)
            old = None
            if os.path.exists(path):
                with open(path, encoding="utf-8", newline="") as f:
                    old = f.read().replace("\r\n", "\n")
            if old != text.replace("\r\n", "\n"):
                differs += 1             # a revision can change nothing in the text we keep
            write_crlf(path, text)
            have[title] = {"file": fn, "pageid": pageid, "revid": revid, "timestamp": ts}
            got += 1
    if prune:
        for t in gone:
            fn = have[t].get("file")
            if fn and os.path.exists(os.path.join(RAW_DIR, fn)):
                os.remove(os.path.join(RAW_DIR, fn))
            del have[t]
        if gone:
            print(f"Pruned {len(gone)} page(s) the wiki no longer has.")
    elif gone:
        print(f"{len(gone)} page(s) are no longer on the wiki; kept. Rerun with --prune to drop them.")

    content_changed = differs > 0 or bool(prune and gone)
    if content_changed:
        idx["fetched"] = today      # a new snapshot
    idx["checked"] = today
    save_index(idx)
    print(f"Downloaded {got} page(s), {differs} with different text. Snapshot date: {idx['fetched']}"
          f"{' (unchanged - nothing new)' if not content_changed else ''}. Next: python utilities/wiki_parse.py")
    return 0


def refresh_travellermap():
    """TravellerMap's mainworld (Name, UWP, Stellar, PBG, Bases, Remarks) for every snapshot
    hex, and each sector's short code. One request per sector plus one for the codes."""
    today = datetime.date.today().isoformat()
    if not os.path.isdir(CLEAN_DIR):
        print("No otu_systems/clean/ yet - run utilities/wiki_parse.py first.")
        return 1
    hexes = {}
    for fn in os.listdir(CLEAN_DIR):
        if fn.endswith(".json"):
            with open(os.path.join(CLEAN_DIR, fn), encoding="utf-8") as f:
                s = json.load(f)
            hexes.setdefault(s["sector"], set()).add(s["hex"])
    worlds = {}
    for sector in sorted(hexes):
        print(f"TravellerMap: {sector} ...")
        tsv = get(f"{TM_API}/sec", {"sector": sector, "type": "TabDelimited"}, accept_json=False)
        lines = tsv.splitlines()
        hdr = lines[0].split("\t")
        for line in lines[1:]:
            row = dict(zip(hdr, line.split("\t")))
            if row.get("Hex") in hexes[sector]:
                rec = {k: row.get(k) for k in ("Name", "UWP", "PBG", "Bases", "Remarks")}
                # The TSV calls the star list "Stars" (the /data endpoint calls it "Stellar")
                rec["Stellar"] = row.get("Stellar", row.get("Stars"))
                worlds[f"{sector} {row['Hex']}"] = {k: rec[k] for k in
                                                    ("Name", "UWP", "Stellar", "PBG", "Bases", "Remarks")}
    print("TravellerMap: sector short codes ...")
    uni = get(f"{TM_API}/universe", {"requireData": 1})
    abbr = {}
    for s in uni.get("Sectors", []):
        for n in s.get("Names", []):
            if n.get("Text") in hexes and s.get("Abbreviation"):
                abbr[n["Text"]] = s["Abbreviation"]
    missing = sorted(f"{sec} {h}" for sec, hs in hexes.items() for h in hs if f"{sec} {h}" not in worlds)
    doc = {"fetched": today,
           "source": "travellermap.com /api/sec?type=TabDelimited (mainworld only)",
           "worlds": dict(sorted(worlds.items())),
           "sector_abbreviations": dict(sorted(abbr.items()))}
    write_crlf(TM_FILE, json.dumps(doc, indent=2, ensure_ascii=False) + "\n")
    print(f"{len(worlds)} hexes, {len(abbr)} sector codes -> {TM_FILE}")
    if missing:
        print(f"No TravellerMap world at {len(missing)} snapshot hex(es): {', '.join(missing)}")
    print("Next: python utilities/wiki_parse.py")
    return 0


def main():
    ap = argparse.ArgumentParser(description="Fetch stage for the Traveller wiki snapshot.")
    ap.add_argument("--dry-run", action="store_true", help="report what changed; download nothing")
    ap.add_argument("--prune", action="store_true", help="drop pages the wiki no longer has")
    ap.add_argument("--travellermap", action="store_true",
                    help="refresh otu_systems/travellermap_mainworlds.json instead")
    a = ap.parse_args()
    os.makedirs(RAW_DIR, exist_ok=True)
    if a.travellermap:
        return refresh_travellermap()
    return refresh_wiki(a.dry_run, a.prune)


if __name__ == "__main__":
    sys.exit(main())

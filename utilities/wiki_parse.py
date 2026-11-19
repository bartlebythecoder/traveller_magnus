"""
utilities/wiki_parse.py

Offline parser for the Traveller wiki snapshot (v0.19.0, manifest §0.0.D).

    python utilities/wiki_parse.py

Reads   otu_systems/raw/          (wikitext as fetched, plus index.json)
        otu_systems/corrections/  (hand fixes, one file per system; never written here)
Writes  otu_systems/clean/        (one JSON file per system, rebuilt from scratch each run)
        otu_systems/parse_report.md  (everything the parser could not settle on its own)

It never contacts the wiki. It invents no game facts: every value is kept as the wiki wrote
it ("raw"), alongside the cleaned reading. Where a reading is a guess about notation (e.g. "GS4"
read as a small gas giant), the body is flagged and listed in the report for a person to decide.

All files are written with CRLF line endings (the repo is CRLF).
"""

import json
import os
import re
import sys
from collections import defaultdict, OrderedDict

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "otu_systems"))
RAW_DIR = os.path.join(ROOT, "raw")
CORR_DIR = os.path.join(ROOT, "corrections")
CLEAN_DIR = os.path.join(ROOT, "clean")
REPORT = os.path.join(ROOT, "parse_report.md")
# TravellerMap's mainworld for each snapshot hex, saved by hand (2026-11-16) so the parser stays
# offline. Used only to say WHICH wiki body is the mainworld, and to report differences.
TM_FILE = os.path.join(ROOT, "travellermap_mainworlds.json")

PARSER_VERSION = 20


# --------------------------------------------------------------------------------------------
# Wikitext helpers
# --------------------------------------------------------------------------------------------

def find_templates(text, name_re):
    """Return [(name, body)] for every template call whose name fully matches name_re.
    Brace-matched, so templates nested inside parameter values are handled."""
    out = []
    i = 0
    while True:
        j = text.find("{{", i)
        if j < 0:
            break
        depth, k = 0, j
        while k < len(text):
            if text.startswith("{{", k):
                depth += 1
                k += 2
            elif text.startswith("}}", k):
                depth -= 1
                k += 2
                if depth == 0:
                    break
            else:
                k += 1
        body = text[j + 2:k - 2]
        name = re.split(r"[|\n]", body, maxsplit=1)[0].strip()
        if re.fullmatch(name_re, name, re.I):
            out.append((name, body))
        i = j + 2
    return out


def split_params(body):
    """Split a template body into {name: value}; '|' inside {{ }} or [[ ]] is not a separator."""
    parts, cur = [], []
    depth = sq = 0
    i = 0
    while i < len(body):
        two = body[i:i + 2]
        if two in ("{{", "}}", "[[", "]]"):
            depth += {"{{": 1, "}}": -1}.get(two, 0)
            sq += {"[[": 1, "]]": -1}.get(two, 0)
            cur.append(two)
            i += 2
            continue
        ch = body[i]
        if ch == "|" and depth == 0 and sq == 0:
            parts.append("".join(cur))
            cur = []
        else:
            cur.append(ch)
        i += 1
    parts.append("".join(cur))
    params, pos = OrderedDict(), 0
    for p in parts[1:]:
        if "=" in p:
            k, v = p.split("=", 1)
            params[k.strip()] = v.strip()
        else:
            pos += 1
            params[str(pos)] = p.strip()
    return params


def strip_markup(v):
    """Wiki/HTML markup -> plain text. Keeps the words, drops formatting, links and citations."""
    if v is None:
        return ""
    s = v
    s = re.sub(r"<!--.*?-->", "", s, flags=re.S)
    s = re.sub(r"<ref[^>]*/>|<ref[^>]*>.*?</ref>", "", s, flags=re.S | re.I)
    # drop nested templates (citations etc.) — repeat for nesting
    for _ in range(5):
        s2 = re.sub(r"\{\{[^{}]*\}\}", "", s)
        if s2 == s:
            break
        s = s2
    s = re.sub(r"<br\s*/?>", " ", s, flags=re.I)
    s = re.sub(r"</?[a-zA-Z][^>]*>", "", s)              # small, big, sup, span, ...
    s = re.sub(r"\[\[(?:File|Image):[^\]]*\]\]", "", s, flags=re.I)  # images: drop entirely
    s = re.sub(r"\[\[(?:[^\]]*\|)?([^|\]]*)\]\]", r"\1", s)  # [[target|label]] -> label
    s = re.sub(r"\[https?://\S+\s+([^\]]*)\]", r"\1", s)    # [url label] -> label
    s = s.replace("'''", "").replace("''", "")
    s = re.sub(r"'+$", "", s.strip())                     # a stray unmatched quote mark
    s = s.replace("&nbsp;", " ").replace("&amp;", "&")
    s = re.sub(r"^\s*\*\s*", "", s)                      # moon names start with "* "
    s = re.sub(r"^\s*»+\s*", "", s)                 # "»" / "»»" indent markers
    # Some editors pad a cell with dots coloured almost white, to line columns up.
    s = re.sub(r"^\s*\.{2,}\s*", "", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


# --------------------------------------------------------------------------------------------
# Readings of individual values
# --------------------------------------------------------------------------------------------

UWP_RE = re.compile(r"^([A-HXY?][0-9A-Z?]{6}-[0-9A-Z?])(.*)$")
SPEC_RE = re.compile(r"^([OBAFGKMLTY]\d(?:\.\d)?\s*(?:Ia|Ib|II|III|IV|V|VI|VII|D)\b|BD\b|D\b)", re.I)
GG_WORDS_RE = re.compile(r"\b(gas giant|giant|gg|lgg|sgg)\b", re.I)
GG_CODE_RE = re.compile(r"^G([SL])(G|\d+)?$", re.I)      # GS3, GS4, GLG, GL ...
SIZE_RE = re.compile(r"\bsiz(?:e)?\s*=?\s*(\d+(?:\.\d+)?)", re.I)


def read_body_value(raw):
    """Read the 'UWP' column of a body row. Returns a dict and a list of review flags."""
    clean = strip_markup(raw)
    flags = []
    r = {"raw": raw, "kind": "unknown"}
    if clean in ("", "?", "??"):
        r["kind"] = "unknown"
        if clean:
            flags.append("uwp-unknown")
        return r, flags
    up = clean.upper()
    m = UWP_RE.match(up.replace(" ", "")) if re.match(r"^[A-HXY?][0-9A-Z?]{6}-", up) else None
    if m:
        r["kind"] = "world"
        r["uwp"] = m.group(1)
        rest = clean[len(m.group(1)):].strip() if clean.upper().startswith(m.group(1)) else ""
        if rest and rest.upper() == "RE":
            # Sean, 2026-11-16: "Re" after a UWP is the trade code Re (Massilia 0402).
            r["trade_codes"] = ["Re"]
            flags.append("uwp-trade-code-re")
        elif rest:
            r["remark"] = rest
            flags.append("uwp-with-remark")
        return r, flags
    if "EMPTY" in up:
        r["kind"] = "empty"
        return r, flags
    if re.fullmatch(r"RINGS?", up):
        r["kind"] = "ring"
        return r, flags
    sm = SPEC_RE.match(clean)
    if sm:
        r["kind"] = "star"
        r["type"] = re.sub(r"\s+", " ", sm.group(1).strip())
        rest = clean[sm.end():].strip(" ()-")
        if rest:
            r["remark"] = rest
        flags.append("star-in-orbit-row")
        return r, flags
    gc = GG_CODE_RE.match(up)
    if gc or GG_WORDS_RE.search(clean):
        r["kind"] = "gas_giant"
        words = up
        if gc:
            # Sean, 2026-11-16: GS = small gas giant, GL = large; a trailing digit is kept as
            # the code's size value, as written ("GLG" has none).
            r["size_class"] = "Small" if gc.group(1) == "S" else "Large"
            if gc.group(2) and gc.group(2).isdigit():
                r["size_value"] = gc.group(2)
            flags.append("gg-code-notation")
        elif re.search(r"\b(SMALL|SGG)\b", words):
            r["size_class"] = "Small"
        elif re.search(r"\b(LARGE|LGG)\b", words):
            r["size_class"] = "Large"
        else:
            flags.append("gg-no-size-class")
        sz = SIZE_RE.search(clean)
        if sz:
            r["size_value"] = sz.group(1)
        other = re.sub(r"\b(SMALL|LARGE|GAS GIANT|GG|LGG|SGG)\b|SIZ(E)?\s*=?\s*\d+(\.\d+)?|[()\-=\s]", "", up)
        if other and not gc:
            r["remark"] = clean
            flags.append("gg-other-words")
        return r, flags
    # A malformed UWP-looking code (wrong length / missing dash) — keep it, flag it.
    if re.fullmatch(r"[A-HXY?][0-9A-Z?]{5,9}(-?[0-9A-Z?])?", up.replace(" ", "")):
        r["kind"] = "world"
        r["uwp_malformed"] = clean
        flags.append("uwp-malformed")
        return r, flags
    r["remark"] = clean
    flags.append("value-unreadable")
    return r, flags


DIST_RE = re.compile(r"^(~|<|>|ca\.?\s*)?(\d+(?:\.\d+)?|\?+)\s*(AU|Diam|Diameters?|Radii|Radius|R)?$", re.I)


def read_distance(raw, is_orbit):
    """Read a distance. The template prints ' AU' after every ORBIT distance, so a bare number
    in an orbit row is AU; a moon row prints the value bare, so a bare moon number has no unit."""
    clean = strip_markup(raw)
    flags = []
    d = {"raw": raw}
    if clean in ("", "?", "??", "-"):
        d["value"] = None
        return d, (["dist-unknown"] if clean else [])
    c = re.sub(r"^\((\?+)\)$", r"\1", clean)
    if c in ("?", "??"):
        d["value"] = None
        return d, ["dist-unknown"]
    rm = re.match(r"^R\s*=\s*(.+)$", c, re.I)
    unit_from_prefix = None
    if rm:
        # Sean, 2026-11-16: "R= N" and "N Radii" both mean planetary radii.
        c, unit_from_prefix = rm.group(1).strip(), "Radii"
        if c in ("?", "??"):
            d["value"] = None
            d["unit"] = "Radii"
            return d, ["dist-unknown"]
    c = re.sub(r"^\.+\s*", "", c)
    m = DIST_RE.match(c)
    if not m:
        d["value"] = None
        flags.append("dist-unreadable")
        return d, flags
    unit = unit_from_prefix or (m.group(3) or "")
    unit = {"diam": "Diam", "diameter": "Diam", "diameters": "Diam", "radii": "Radii",
            "radius": "Radii", "r": "Radii", "au": "AU"}.get(unit.lower(), unit or None)
    if m.group(2).startswith("?"):
        d["value"] = None
        if unit:
            d["unit"] = unit
        return d, ["dist-unknown"]
    d["value"] = float(m.group(2))
    if unit is None and is_orbit:
        unit = "AU"
    assumed = False
    if unit is None and not is_orbit:
        # Sean, 2026-11-16: a bare moon distance is in planetary diameters, like the moons
        # written "N Diam". Recorded as assumed, not written.
        unit = "Diam"
        assumed = True
    d["unit"] = unit
    if assumed:
        d["unit_assumed"] = True
    if m.group(1):
        d["qualifier"] = m.group(1).strip()
        flags.append("dist-approximate")
    if assumed:
        flags.append("dist-moon-no-unit")
    elif unit == "Radii":
        flags.append("dist-radii")
    return d, flags


def split_stars(name_raw, type_raw):
    """The primary's own fields can hold a close pair: star='Lusor/Speck', type='F7 V / BD'."""
    # Strip the markup BEFORE splitting on "/", or "</small>" is cut in half (Jae Tellona).
    names = [x.strip() for x in re.split(r"/|\s&\s", strip_markup(name_raw))] if name_raw else []
    types = [x.strip() for x in strip_markup(type_raw).split("/")] if type_raw else []
    names = [n for n in names if n]
    types = [t for t in types if t]
    # A close pair written with a space instead of "/" ("F1 V M3 V", "G4 V D"): split the type
    # into its spectral tokens. The names are then given by the star template (see main).
    if len(types) == 1:
        toks = re.findall(r"[OBAFGKMLTY]\d(?:\.\d)?\s*(?:Ia|Ib|III|II|IV-V|IV|VII|VI|V|D)\b|\bBD\b|\bD[ABCOQZ]?\b",
                          types[0])
        if len(toks) > 1 and re.sub(r"\s", "", "".join(toks)) == re.sub(r"\s", "", types[0]):
            types = [t.strip() for t in toks]
            if len(names) == 1:
                names = [names[0]] + [None] * (len(types) - 1)
    n = max(len(names), len(types))
    return [{"name": names[i] if i < len(names) else None,
             "type": types[i] if i < len(types) else None} for i in range(n)]


STAR_ROLES = ["Primary", "Secondary", "Tertiary", "Quaternary", "Quinary", "Senary", "Sextenary"]


def read_star_template(params):
    """Binary/TrinaryStarSystem etc.: PrimaryName/primary/PrimaryNotes, SecondaryName/...
    Returns stars in role order."""
    out = []
    lower = {k.lower(): v for k, v in params.items()}
    for role in STAR_ROLES:
        t = lower.get(role.lower())
        nm = lower.get(role.lower() + "name")
        if t is None and nm is None:
            continue
        out.append({"role": role, "name": strip_markup(nm) or None, "type": strip_markup(t) or None,
                    "notes": strip_markup(lower.get(role.lower() + "notes", "")) or None})
    return out


# --------------------------------------------------------------------------------------------
# Page -> infobox systems
# --------------------------------------------------------------------------------------------

def read_body_row(params, key_prefix, is_orbit, page, flags_out, label):
    name_raw = params.get(key_prefix["P"], "")
    # A trailing location tag such as "(SR 1827)" only makes a wiki link unique; drop it.
    name = re.sub(r"\s*\([A-Za-z]{1,4} \d{4}\)$", "", strip_markup(name_raw))
    val, f1 = read_body_value(params.get(key_prefix["UWP"], ""))
    dist, f2 = read_distance(params.get(key_prefix["Dist"], ""), is_orbit)
    body = OrderedDict()
    body["name"] = name or None
    if name_raw and name_raw != name:
        body["name_raw"] = name_raw
    body.update(val)
    body["distance"] = dist
    if body.get("kind") == "unknown" and not body.get("uwp") and not body.get("remark"):
        if not name or re.fullmatch(r"[-–—\s]+", name):
            # A row with no name (or only dashes) and no UWP is layout filler: an empty orbit.
            body["kind"] = "empty"
            f1 = f1 + ["placeholder-row-empty"]
        elif is_orbit and re.search(r"\bbelt\b", name, re.I):
            # Sean, 2026-11-16: a row named "... Belt" with no UWP is Y000000-0 (so it loads as a
            # Planetoid Belt by the size-0 rule).
            body["kind"] = "world"
            body["uwp"] = "Y000000-0"
            f1 = f1 + ["belt-uwp-assumed"]
    flags = f1 + f2
    if flags:
        body["flags"] = flags
        for f in flags:
            flags_out.append((f, page, label, name))
    return body


def read_infobox(params, page, flags_out):
    sysbox = OrderedDict()
    sysbox["page"] = page
    sysbox["label"] = strip_markup(params.get("name", "")) or None
    sysbox["stars"] = split_stars(params.get("star", ""), params.get("type", ""))
    unknown = [k for k in params if not re.fullmatch(
        r"(name|star|type|subsector|sector|hex|P\d+|Dist\d+|UWP\d+|P\d+M\d+|Dist\d+M\d+|UWP\d+M\d+)", k)]
    unknown = [k for k in unknown if params[k].strip()]
    if unknown:
        sysbox["unused_fields"] = OrderedDict((k, params[k]) for k in unknown)
        for k in unknown:
            flags_out.append(("unused-template-field", page, sysbox["label"], f"{k} = {params[k][:60]}"))
    orbits = []
    for k in params:
        m = re.fullmatch(r"P(\d+)", k)
        if not m or not params[k].strip():
            continue
        n = int(m.group(1))
        body = read_body_row(params, {"P": f"P{n}", "UWP": f"UWP{n}", "Dist": f"Dist{n}"},
                             True, page, flags_out, sysbox["label"])
        body = OrderedDict([("orbit", n)] + list(body.items()))
        moons = []
        for mk in params:
            mm = re.fullmatch(rf"P{n}M(\d+)", mk)
            if not mm or not params[mk].strip():
                continue
            j = int(mm.group(1))
            moon = read_body_row(params, {"P": f"P{n}M{j}", "UWP": f"UWP{n}M{j}", "Dist": f"Dist{n}M{j}"},
                                 False, page, flags_out, sysbox["label"])
            moons.append(OrderedDict([("index", j)] + list(moon.items())))
        moons.sort(key=lambda x: x["index"])
        if moons:
            body["moons"] = moons
        orbits.append(body)
    orbits.sort(key=lambda x: x["orbit"])
    for o in orbits:
        if o.get("kind") == "star" and o.get("moons"):
            nest_companion_bodies(o, page, sysbox["label"], flags_out)
    sysbox["orbits"] = orbits
    return sysbox


def nest_companion_bodies(star_row, page, label, flags_out):
    """Sean, 2026-11-16: a star written into a planet row is a companion occupying that orbit,
    and the bodies listed under it are its planets, at the distances given. The wiki's own
    display nests one level deeper inside those rows: a body in AU is a planet of the
    companion; a following body measured in planetary diameters/radii (or marked '»»') is a
    moon of the planet above it (Porozlo: Glint -> Czaczezhnia 0.2 AU -> rings and moons at
    R= 1..55). Every row read this way is flagged for review."""
    planets = []
    for m in star_row.pop("moons"):
        unit = (m.get("distance") or {}).get("unit")
        deeper = m.get("name_raw", "").lstrip().startswith(("»»", "* »»")) or unit in ("Diam", "Radii")
        m = OrderedDict((k, v) for k, v in m.items() if k != "index")
        if deeper and planets:
            planets[-1].setdefault("moons", []).append(m)
            flags_out.append(("companion-moon-nested", page, label, f"{star_row.get('name')} > "
                              f"{planets[-1].get('name')} > {m.get('name')}"))
        else:
            if unit != "AU":
                flags_out.append(("companion-planet-not-au", page, label,
                                  f"{star_row.get('name')} > {m.get('name')} ({unit})"))
            planets.append(m)
    star_row["planets"] = planets


def norm_key(s):
    return re.sub(r"\s+", " ", (s or "")).strip().lower()


# --------------------------------------------------------------------------------------------
# Merging several pages' infoboxes into one system (Sean, 2026-11-16: "keep all, merge them")
# --------------------------------------------------------------------------------------------

# Fields compared between pages. A body is the same body on two pages when its orbit number
# (a moon: its parent's orbit and its name) matches; the fields below are then compared.
COMPARE = ["name", "kind", "uwp", "uwp_malformed", "size_class", "size_value", "type", "remark", "trade_codes"]


def body_name_key(name):
    """Moons are matched across pages by name. Ignore case and a trailing location tag such as
    '(SR 1827)' that some pages add to make a wiki link unique."""
    n = norm_key(name).replace("–", "-").replace("—", "-")
    n = re.sub(r"\s*\([a-z]{1,4} \d{4}\)$", "", n)
    # An alternate name in brackets after the name ("Kaleal (Kihyo)" on one page, "Kaleal" on
    # the other) is the same body. A name that is ONLY brackets ("(Ring 1)") is kept whole.
    base = re.sub(r"\s*\([^()]*\)$", "", n)
    return base or n


def fields_of(body):
    out = {k: body.get(k) for k in COMPARE}
    out["name"] = body_name_key(body.get("name"))
    d = body.get("distance") or {}
    out["distance"] = (d.get("value"), d.get("unit"))
    return out


def page_priority(pages, corr):
    """Which page wins where pages disagree: the correction's 'page_priority' list first (in
    its order), then '(system)' pages, then the rest alphabetically."""
    pref = [p for p in (corr or {}).get("page_priority", []) if p in pages]
    rest = sorted((p for p in pages if p not in pref), key=lambda p: (0 if "(system)" in p.lower() else 1, p))
    return pref + rest


def merge_bodies(candidates, order, where, conflicts, ruled=()):
    """candidates: [(page, body)] describing the same body. Returns the merged body: the
    highest-priority page's reading, with 'sources' naming every page that has it. Every field
    that differs between pages is recorded in conflicts (never silently)."""
    rank = {p: i for i, p in enumerate(order)}
    candidates = sorted(candidates, key=lambda pb: rank.get(pb[0], 99))
    win_page, win = candidates[0]
    merged = OrderedDict((k, v) for k, v in win.items() if k != "moons")
    merged["sources"] = [p for p, _ in candidates]
    if len(candidates) > 1:
        base = fields_of(win)
        for page, b in candidates[1:]:
            other = fields_of(b)
            for k in base:
                if base[k] != other[k] and other[k] not in (None, (None, None)):
                    # "ruled": the winner was named in a page_priority correction, so Sean has
                    # settled it; the report counts these but does not list them as open.
                    conflicts.append(where + (k, win_page, _show(base[k]), page, _show(other[k]),
                                              win_page in ruled))
    return merged


def _show(v):
    if isinstance(v, tuple):
        return " ".join(str(x) for x in v if x is not None) or "—"
    return "—" if v is None else str(v)


def merge_group(key, boxes, corr, conflicts):
    """boxes: every infobox (across pages) whose primary star is the same. Returns one merged
    system: orbits by orbit number, moons by name within an orbit."""
    pages = sorted({b["page"] for b in boxes})
    order = page_priority(pages, corr)
    rank = {p: i for i, p in enumerate(order)}
    boxes = sorted(boxes, key=lambda b: rank[b["page"]])
    star_name = boxes[0]["stars"][0]["name"] if boxes[0]["stars"] else None
    by_orbit = defaultdict(list)
    for b in boxes:
        for o in b["orbits"]:
            by_orbit[o["orbit"]].append((b["page"], o))
    orbits = []
    for n in sorted(by_orbit):
        cands = by_orbit[n]
        ruled = tuple((corr or {}).get("page_priority", []))
        o = merge_bodies(cands, order, (key, star_name, n, ""), conflicts, ruled)
        moon_sets = defaultdict(list)
        moon_order = []
        for page, ob in sorted(cands, key=lambda pb: rank[pb[0]]):
            # Match by name; a generic name used twice in one orbit ("Moon", "Ring") is told
            # apart by its occurrence: the 2nd "Moon" on one page matches the 2nd on another.
            seen_here = defaultdict(int)
            for m in ob.get("moons", []):
                base = body_name_key(m.get("name")) or f"#{m['index']}"
                seen_here[base] += 1
                k = (base, seen_here[base])
                if k not in moon_sets:
                    moon_order.append(k)
                moon_sets[k].append((page, m))
        if moon_order:
            o["moons"] = [merge_bodies(moon_sets[k], order, (key, star_name, n, moon_sets[k][0][1].get("name")),
                                       conflicts, ruled) for k in moon_order]
        orbits.append(o)
    g = OrderedDict()
    g["star"] = star_name
    g["stars"] = boxes[0]["stars"]
    g["labels"] = [b["label"] for b in boxes]
    g["pages"] = order
    g["orbits"] = orbits
    return g


# --------------------------------------------------------------------------------------------
# Corrections
# --------------------------------------------------------------------------------------------

def load_corrections():
    """corrections/<Sector> <hex>.json, e.g.
        {
          "exclude_pages": ["Sandbox"],
          "page_priority": ["Terra (system)", "Jupiter (world)"],
          "infobox_stars": { "Risek (world)": [ {"name": "Orb", "type": "M2 V"},
                                              {"name": "Secondary", "type": "M3 V"} ] },
          "stars_settled": true,
          "name": "Regina",
          "sector": "Trojan Reach",
          "bodies": {
            "Caladbolg (world)|Companion 1": { "drop": true },
            "Corella (world)|Planet X": { "kind": "gas_giant", "size_class": "Small" },
            "Masiruu (world)|UN@2": { "uwp": "X100000-0", "uwp_malformed": null }
          }
        }
    Body keys are '<page title>|<body name as cleaned>'. A body override replaces fields; the
    original reading stays in 'raw'. Files whose name starts with '_' are ignored."""
    out = {}
    if not os.path.isdir(CORR_DIR):
        return out
    for fn in sorted(os.listdir(CORR_DIR)):
        if not fn.endswith(".json") or fn.startswith("_"):
            continue
        with open(os.path.join(CORR_DIR, fn), encoding="utf-8") as f:
            out[fn[:-5]] = json.load(f)
    return out


CORRECTED = set()   # (page, body name) of every body a correction touched — its flags are settled


def apply_body_corrections(sysbox, corr, used):
    """Body keys: '<page>|<name>', or '<page>|<name>@<orbit>' when a page has two bodies of the
    same name (Masiruu's two "UN"s). For a moon, or a companion star's planet, <orbit> is the
    orbit of the row it sits under. `used` counts matches per key; a plain key matching more
    than one body is reported as ambiguous by the caller."""
    bodies = (corr or {}).get("bodies", {})

    def fix(body, orbit_n):
        base = f"{sysbox['page']}|{body.get('name')}"
        key = f"{base}@{orbit_n}" if f"{base}@{orbit_n}" in bodies else base
        if key not in bodies:
            return body
        used[key] = used.get(key, 0) + 1
        ov = bodies[key]
        CORRECTED.add((sysbox["page"], body.get("name")))
        if ov.get("drop"):
            return None
        body = OrderedDict(body)
        for k, v in ov.items():
            body[k] = v
        body["corrected"] = True
        body.pop("flags", None)
        return body

    def fix_list(items, n):
        out = []
        for x in items:
            x = fix(x, n)
            if x is None:
                continue
            if "moons" in x:
                x["moons"] = fix_list(x["moons"], n)
            if "planets" in x:
                x["planets"] = fix_list(x["planets"], n)
            out.append(x)
        return out

    new_orbits = []
    for o in sysbox["orbits"]:
        n = o["orbit"]
        o = fix(o, n)
        if o is None:
            continue
        if "moons" in o:
            o["moons"] = fix_list(o["moons"], n)
        if "planets" in o:
            o["planets"] = fix_list(o["planets"], n)
        new_orbits.append(o)
    sysbox["orbits"] = new_orbits


# --------------------------------------------------------------------------------------------
# Output
# --------------------------------------------------------------------------------------------

def write_crlf(path, text):
    with open(path, "wb") as f:
        f.write(text.replace("\r\n", "\n").replace("\n", "\r\n").encode("utf-8"))


def safe_name(s):
    return re.sub(r'[\\/:*?"<>|]', "_", s)


def out_sector_for_report(corr, sector):
    return (corr or {}).get("sector") or sector


def main():
    with open(os.path.join(RAW_DIR, "index.json"), encoding="utf-8") as f:
        index = json.load(f)
    pages = index["pages"]
    corrections = load_corrections()
    tm = {}
    if os.path.exists(TM_FILE):
        with open(TM_FILE, encoding="utf-8") as f:
            tm_doc = json.load(f)
        tm = tm_doc.get("worlds", {})

    flags = []                          # (flag, page, infobox label, detail)
    no_infobox = []
    by_loc = defaultdict(list)          # (sector, hex) -> [infobox dicts]
    loc_meta = defaultdict(lambda: {"subsectors": set(), "pages": OrderedDict()})
    star_templates = defaultdict(list)  # (sector, hex) -> [(page, stars)]

    for title in sorted(pages):
        meta = pages[title]
        with open(os.path.join(RAW_DIR, meta["file"]), encoding="utf-8") as f:
            text = f.read()
        calls = find_templates(text, r"InfoboxSystem")
        if not calls:
            no_infobox.append(title)
            continue
        page_locs = set()
        for _, body in calls:
            p = split_params(body)
            sector = strip_markup(p.get("sector", ""))
            hexn = strip_markup(p.get("hex", ""))
            if not re.fullmatch(r"\d{4}", hexn) or not sector:
                flags.append(("bad-location", title, strip_markup(p.get("name", "")), f"{sector!r} {hexn!r}"))
                continue
            box = read_infobox(p, title, flags)
            by_loc[(sector, hexn)].append(box)
            loc_meta[(sector, hexn)]["subsectors"].add(strip_markup(p.get("subsector", "")))
            loc_meta[(sector, hexn)]["pages"][title] = {"revid": meta["revid"], "timestamp": meta["timestamp"]}
            page_locs.add((sector, hexn))
        stpl = find_templates(text, r"(Monostellar|Binary|Trinary|Quaternary|Quinary|Sextenary)(Star)?System")
        for loc in page_locs:
            for name, b in stpl:
                star_templates[loc].append((title, name, read_star_template(split_params(b))))

    if os.path.isdir(CLEAN_DIR):
        for fn in os.listdir(CLEAN_DIR):
            if fn.endswith(".json"):
                os.remove(os.path.join(CLEAN_DIR, fn))
    os.makedirs(CLEAN_DIR, exist_ok=True)

    multi_page, collisions, star_mismatch, excluded, unused_corr = [], [], [], [], []
    mw_missing, mw_differs = [], []
    no_placement = []
    systems_written = 0
    for loc in sorted(by_loc):
        sector, hexn = loc
        key = f"{sector} {hexn}"
        corr = corrections.get(safe_name(key), {})
        excl = set(corr.get("exclude_pages", []))
        boxes = [b for b in by_loc[loc] if b["page"] not in excl]
        for t in sorted({b["page"] for b in by_loc[loc] if b["page"] in excl}):
            excluded.append((key, t))
        if not boxes:
            continue
        # "infobox_stars": {"<page>" or "<page>#<n>": [{"name", "type"}, ...]} replaces the star
        # list of that page's n-th infobox, before grouping (so duplicate pages whose star names
        # were written differently can merge). Sean, 2026-11-16: TravellerMap's star list is the
        # final answer where the wiki contradicts itself.
        per_page = defaultdict(int)
        for b in boxes:
            per_page[b["page"]] += 1
            ist = corr.get("infobox_stars", {})
            k = f"{b['page']}#{per_page[b['page']]}"
            new = ist.get(k) if k in ist else (ist.get(b["page"]) if per_page[b["page"]] == 1 else None)
            if new is not None:
                b["stars_as_written"] = b["stars"]
                b["stars"] = new
        used = {}
        for b in boxes:
            apply_body_corrections(b, corr, used)
        for k in corr.get("bodies", {}):
            if k not in used:
                unused_corr.append((key, k, "matched nothing"))
            elif used[k] > 1 and "@" not in k:
                unused_corr.append((key, k, f"AMBIGUOUS: applied to {used[k]} bodies — add @<orbit>"))
        page_titles = sorted({b["page"] for b in boxes})
        if len(page_titles) > 1:
            multi_page.append((key, page_titles))

        # Merge every page's infoboxes that describe the same star (Sol over five pages; a
        # system and its duplicate page). A companion's own subsystem (a second infobox with a
        # different star, e.g. Regina's Darida) stays a separate group. Where pages disagree the
        # higher-priority page's reading is kept and the difference goes to the report.
        # Two infoboxes on the SAME page are never the same system, even when both name their
        # star generically ("Primary") or not at all (Kwan, Grille): a page does not duplicate
        # itself. So a box joins a group only if that group has nothing from its page yet.
        groups = OrderedDict()
        for b in boxes:
            primary = norm_key(b["stars"][0]["name"] if b["stars"] else None)
            n = 1
            gk = (primary, n)
            while gk in groups and any(x["page"] == b["page"] for x in groups[gk]):
                n += 1
                gk = (primary, n)
            groups.setdefault(gk, []).append(b)
        merged_groups = [merge_group(key, bs, corr, collisions) for bs in groups.values()]
        # A belt's "moons" are the objects inside it (Sol's Kuiper Belt: Pluto, Eris, ...).
        for g in merged_groups:
            for o in g["orbits"]:
                if o.get("kind") == "belt" and "moons" in o:
                    o["objects"] = o.pop("moons")

        stpl_stars = star_templates.get(loc, [])
        def norm_type(t):
            return re.sub(r"\s+", "", (t or "")).upper()

        # A pair split from one field has only the first name; take the names from the star
        # template when its types are the same stars in the same order (Collace: "Gorie Sonor").
        if stpl_stars:
            tpl = stpl_stars[0][2]
            for g in merged_groups:
                st = g["stars"]
                if len(st) > 1 and any(x["name"] is None for x in st[1:]) and                         [norm_type(x["type"]) for x in st] == [norm_type(x["type"]) for x in tpl[:len(st)]]:
                    tnames = [tpl[i]["name"] for i in range(len(st))]
                    # "Gorie Sonor" in one field is the template's "Gorie" + "Sonor" run together.
                    joined = norm_key(" ".join(n for n in tnames if n))
                    first = st[0]["name"] if norm_key(st[0]["name"]) != joined else None
                    names = [first] + [x["name"] for x in st[1:]]
                    g["stars"] = [{"name": names[i] or tnames[i], "type": st[i]["type"]}
                                  for i in range(len(st))]
                    g["star_names_from"] = "star template"
        # Where each companion subsystem sits (Sean, 2026-11-16: a companion's role comes from
        # its orbit band, at the wiki's distance). A companion with its own infobox gives no
        # distance there; take it from (1) a star written into an orbit row of another group
        # that is the same star (Algol's beta Persei C is both), else (2) its star template's
        # notes: "Approximately 120 AU from the primary" or "In Orbit 11". The n-th infobox
        # group is matched to the template's n-th star, by type. The loader reads `placement`.
        tpl_list = stpl_stars[0][2] if stpl_stars else []
        for gi, g in enumerate(merged_groups):
            if gi == 0 or not g["stars"]:
                continue
            head = g["stars"][0]
            placement = None
            for og in merged_groups:
                if og is g:
                    continue
                for o in og["orbits"]:
                    if o.get("kind") == "star" and (
                            (head.get("name") and norm_key(o.get("name")) == norm_key(head.get("name"))) or
                            (not head.get("name") and norm_type(o.get("type")) == norm_type(head.get("type")))):
                        d = o.get("distance") or {}
                        placement = OrderedDict([("orbit", o["orbit"]), ("au", d.get("value")),
                                                 ("from", "orbit row")])
                        o["subsystem"] = gi        # the loader places this star once, as the group
            if placement is None:
                cand = tpl_list[gi] if gi < len(tpl_list) else None
                if not cand or norm_type(cand.get("type")) != norm_type(head.get("type")):
                    cand = next((x for x in tpl_list if head.get("name") and
                                 norm_key(x.get("name")) == norm_key(head.get("name"))), None)
                notes = (cand or {}).get("notes") or ""
                m_orbit = re.search(r"\bIn Orbit\s+(\d+)", notes, re.I)
                m_au = re.search(r"([\d,]+(?:\.\d+)?)\s*AU\b", notes)
                if m_orbit:
                    placement = OrderedDict([("orbit", int(m_orbit.group(1))), ("au", None),
                                             ("from", "star template notes")])
                elif m_au:
                    placement = OrderedDict([("orbit", None),
                                             ("au", float(m_au.group(1).replace(",", ""))),
                                             ("from", "star template notes")])
            if placement is None:
                no_placement.append((f"{out_sector_for_report(corr, sector)} {hexn}", head.get("name"), head.get("type")))
            else:
                g["placement"] = placement
        infobox_types = [norm_type(s.get("type")) for g in merged_groups for s in g["stars"]]
        for page, tname, stars in ([] if corr.get("stars_settled") else stpl_stars):
            for s in stars:
                t = norm_type(s.get("type"))
                if t and t not in infobox_types and not any(
                        o.get("kind") == "star" and norm_type(o.get("type")) == t for b in boxes for o in b["orbits"]):
                    star_mismatch.append((key, page, s["role"], s.get("name"), s.get("type")))

        subs = sorted(x for x in loc_meta[loc]["subsectors"] if x)
        out = OrderedDict()
        out["parser_version"] = PARSER_VERSION
        out["snapshot"] = index.get("fetched")
        out["sector"] = corr.get("sector") or sector
        if corr.get("sector") and corr["sector"] != sector:
            out["sector_as_written"] = sector
        out["hex"] = hexn
        # TravellerMap's short code for the sector ("Spin"): a sector imported from a .tsv file
        # is named by it, so bulk matching accepts it as well as the full name.
        abbr = (tm_doc.get("sector_abbreviations") or {}).get(out["sector"]) if tm else None
        if abbr:
            out["sector_abbreviation"] = abbr
        out["subsector"] = subs[0] if len(subs) == 1 else subs
        # The system's name: a correction wins; else the first infobox on a "(system)" page
        # (Sol is spread over Jupiter/Neptune/... pages whose labels read "Jupiter / Terra");
        # else the first infobox.
        sys_boxes = [b for b in boxes if "(system)" in b["page"].lower()]
        out["name"] = corr.get("name") or (sys_boxes or boxes)[0]["label"]
        out["sources"] = [OrderedDict([("page", t)] + list(loc_meta[loc]["pages"][t].items()))
                          for t in page_titles]
        out["star_templates"] = [OrderedDict([("page", p), ("template", n), ("stars", s)])
                                 for p, n, s in stpl_stars]
        out["systems"] = merged_groups      # what the app loads: one entry per star group
        # Each page's infobox as read, for tracing. A deep copy: merged bodies can share objects
        # with these boxes, and marking the mainworld below must not reach into them.
        out["infoboxes"] = json.loads(json.dumps(boxes))

        # The mainworld: the body named as TravellerMap names this hex's world (Sean,
        # 2026-11-16: on load the mainworld keeps the map's = TravellerMap's UWP; every other
        # body comes from the wiki). A "mainworld": "<name>" or "<name>@<orbit>" correction
        # overrides the match.
        t = tm.get(f"{out['sector']} {hexn}")
        if t:
            out["travellermap"] = OrderedDict([("checked", tm_doc.get("fetched"))] + list(t.items()))
        # "single_hex_only": the system never matches in a bulk load (TravellerMap has another
        # world at its hex) but a user can still choose it for a single hex (Dynam).
        if corr.get("single_hex_only"):
            out["single_hex_only"] = True
        want = corr.get("mainworld") or (t or {}).get("Name")
        want_name, _, want_orbit = (want or "").partition("@")
        found = None

        def walk(items, orbit_n):
            for x in items:
                yield x, orbit_n
                for k in ("moons", "planets", "objects"):
                    yield from walk(x.get(k, []), orbit_n)

        if want_name:
            def nk(v):
                return re.sub(r"[^a-z0-9]", "", (v or "").lower())
            for g in merged_groups:
                for o in g["orbits"]:
                    for x, n in walk([o], o["orbit"]):
                        ok_orbit = not want_orbit or str(n) == want_orbit
                        if found is None and ok_orbit and nk(x.get("name")) == nk(want_name):
                            found = x
        if found is not None:
            found["mainworld"] = True
            if t and found.get("uwp") != t.get("UWP"):
                mw_differs.append((f"{out['sector']} {hexn}", found.get("name"), found.get("uwp"), t.get("UWP")))
        else:
            mw_missing.append((f"{out['sector']} {hexn}", out["name"], (t or {}).get("Name"),
                               (t or {}).get("UWP"), corr.get("mainworld")))
        # Named by the (corrected) sector; the corrections file stays named as the wiki wrote it.
        write_crlf(os.path.join(CLEAN_DIR, safe_name(f"{out['sector']} {hexn}") + ".json"),
                   json.dumps(out, indent=2, ensure_ascii=False) + "\n")
        systems_written += 1

    # ---- report -----------------------------------------------------------------------------
    # Flags on bodies a correction has settled, or on excluded pages, are no longer open.
    excluded_pages = {t for _k, t in excluded}
    flags = [f for f in flags if f[1] not in excluded_pages and (f[1], f[3]) not in CORRECTED]
    L = []
    L.append("# Wiki snapshot — parse report")
    L.append("")
    L.append(f"Generated by `utilities/wiki_parse.py` (parser v{PARSER_VERSION}) from the snapshot "
             f"fetched {index.get('fetched')}. Rebuilt on every run; do not edit by hand — fix "
             f"things in `otu_systems/corrections/` instead.")
    L.append("")
    counts = defaultdict(int)
    for f in flags:
        counts[f[0]] += 1
    L.append(f"- Pages read: {len(pages)}; with no InfoboxSystem: {len(no_infobox)}")
    L.append(f"- Systems written to `clean/`: {systems_written}")
    L.append(f"- Correction files loaded: {len(corrections)}")
    L.append("")
    L.append("| Flag | Count |")
    L.append("|---|---|")
    for k in sorted(counts):
        L.append(f"| `{k}` | {counts[k]} |")
    L.append("")

    def section(title, rows, header, note=None):
        L.append(f"## {title} ({len(rows)})")
        L.append("")
        if note:
            L.append(note)
            L.append("")
        if not rows:
            L.append("None.")
            L.append("")
            return
        L.append("| " + " | ".join(header) + " |")
        L.append("|" + "---|" * len(header))
        for r in rows:
            L.append("| " + " | ".join(str(x).replace("|", "\\|") if x is not None else "" for x in r) + " |")
        L.append("")

    sector_counts = defaultdict(int)
    for (sector, _h) in by_loc:
        sector_counts[sector] += 1
    section("No mainworld found", mw_missing,
            ["System", "Wiki name", "TravellerMap world", "TravellerMap UWP", "Correction"],
            "No wiki body is named as TravellerMap names this hex's world. Bulk loading matches on "
            "that name, so the system cannot load in bulk until a `mainworld` correction names the body.")
    section("Mainworld UWP differs from TravellerMap", mw_differs,
            ["System", "Mainworld", "Wiki UWP", "TravellerMap UWP"],
            "For information: on load the mainworld keeps the map's (TravellerMap's) UWP "
            "(Sean, 2026-11-16); the wiki's value stays in the snapshot.")
    section("Sector names used", sorted(sector_counts.items()), ["Sector", "Systems"],
            "Bulk loading matches on the sector name, so a misspelling here (for example "
            "\"Trojan Reaches\" for \"Trojan Reach\") stops a system from ever matching. Fix one "
            "with a `sector` correction.")
    section("Pages with no InfoboxSystem", [(t,) for t in no_infobox], ["Page"])
    section("Pages excluded by a correction", excluded, ["System", "Page"])
    section("Systems described by more than one page", [(k, ", ".join(v)) for k, v in multi_page],
            ["System", "Pages"],
            "Their infoboxes are merged (Sean, 2026-11-16): one body per orbit, moons matched by "
            "name. Disagreements are listed in the next section.")
    settled = [c for c in collisions if c[-1]]
    collisions = [c[:-1] for c in collisions if not c[-1]]
    L.append(f"_{len(settled)} disagreement(s) are settled by a `page_priority` correction and not listed._")
    L.append("")
    section("Where merged pages disagree", collisions,
            ["System", "Star", "Orbit", "Moon", "Field", "Kept (page)", "Kept value", "Other page",
             "Other value"],
            "The kept value is provisional: it comes from the higher-priority page (a "
            "`page_priority` correction, else \"(system)\" pages first, then alphabetical). Change "
            "it with `page_priority` for the whole system, or a `bodies` correction for one body.")
    section("Companion subsystems with no placement", no_placement, ["System", "Star", "Type"],
            "A companion with its own infobox, but no orbit row and no distance in its star template's "
            "notes. The loader cannot place it; give it a correction.")
    section("Stars in a star template but not in the infobox", star_mismatch,
            ["System", "Page", "Role", "Name", "Type"])
    by_flag = defaultdict(list)
    for f in flags:
        by_flag[f[0]].append(f[1:])
    notes = {
        "star-in-orbit-row": "A star written into a planet row (its UWP field holds a spectral type).",
        "gg-code-notation": "Gas giant written as a code such as GS4 / GLG: S = Small, L = Large, a trailing digit kept as size_value (Sean, 2026-11-16).",
        "gg-no-size-class": "Gas giant with no Small/Large given.",
        "gg-other-words": "Gas giant with extra words (Hot, Ice, ...) kept as a remark.",
        "uwp-with-remark": "A valid UWP followed by extra text, kept as a remark.",
        "placeholder-row-empty": "A row with no name (or only dashes) and no UWP: read as an empty orbit.",
        "belt-uwp-assumed": "A row named \"... Belt\" with no UWP: given Y000000-0 (Sean, 2026-11-16).",
        "uwp-trade-code-re": "A UWP followed by \"Re\": loaded as the trade code Re (Sean, 2026-11-16).",
        "uwp-malformed": "Looks like a UWP but is the wrong shape; kept as written in uwp_malformed.",
        "uwp-unknown": "UWP given as ?.",
        "value-unreadable": "The UWP column holds something the parser cannot read.",
        "dist-unknown": "Distance given as ? or left blank in a filled row.",
        "dist-unreadable": "Distance the parser cannot read.",
        "dist-approximate": "Distance with ~, < or > in front.",
        "dist-moon-no-unit": "Moon distance written with no unit; read as planetary diameters (Sean, 2026-11-16) and marked unit_assumed.",
        "dist-radii": "Moon distance written R= or Radii; stored as planetary radii (Sean, 2026-11-16).",
        "companion-moon-nested": "Under a companion star: a body in diameters/radii (or marked »») read as a moon of the planet above it.",
        "companion-planet-not-au": "Under a companion star: a body read as a planet although its distance is not in AU.",
        "unused-template-field": "A field InfoboxSystem does not have, so the wiki never shows it.",
        "bad-location": "An infobox with no usable sector or hex; skipped.",
    }
    for flag in sorted(by_flag):
        rows = by_flag[flag]
        if flag == "dist-moon-no-unit":
            # Too many to list one by one; summarise by page.
            per = defaultdict(int)
            for page, label, name in rows:
                per[page] += 1
            section(f"`{flag}`", sorted(per.items()), ["Page", "Moons"], notes.get(flag))
            continue
        section(f"`{flag}`", rows, ["Page", "Infobox", "Body / detail"], notes.get(flag))
    section("Corrections that need attention", unused_corr, ["System", "Body key", "Problem"],
            "A body key that matched no body (usually a typo or a renamed page), or a plain key "
            "that matched several bodies of the same name — give it an @<orbit> suffix.")
    write_crlf(REPORT, "\n".join(L) + "\n")

    print(f"{systems_written} systems -> {CLEAN_DIR}")
    print(f"report -> {REPORT}")
    for k in sorted(counts):
        print(f"  {k}: {counts[k]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

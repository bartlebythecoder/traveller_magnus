# As Above, So Below (v0.18.2)

**"As Above, So Below"** is a star system generator and sector management tool for the Traveller TTRPG. It provides a seamless transition between sector mapping and the granular physical reality of individual worlds and moons.
---
This tool is an unofficial fan project and is not affiliated with Mongoose Publishing or Far Future Enterprises. 
---

## 🚀 [Launch the Generator (Live Web App)](https://bartlebythecoder.github.io/traveller_magnus/hex_map.html)
*No download required. Runs directly in your browser via GitHub Pages.*

## 📖 Documentation
- **[FAQ](faq.md)** — creating systems and sectors, saving and sharing, editing worlds, images, and routes. Start here.
- **[Route Manager Manual](help_routes.md)** — every route type, parameter, and troubleshooting step in detail.

---

## Overview
This workbench allows Game Masters and world-builders to generate, import, and expand star systems using multiple generations of Traveller logic. Whether you are running a Classic Traveller campaign or a high-crunch Traveller 5 (T5) simulation, this tool ensures that your "expanded" systems remain 100% consistent with your sector-level data.

## Key Features
- **Multi-Era Engine:** Toggle between **Classic Traveller (Book 6)**, **Mongoose Traveller (2nd Edition)**, **Traveller 5 (T5)**, **RTT WorldGen** and **Architect of Worlds** expansion logic.
- **System Editor:** Build a system by hand or reshape a generated one — add and delete stars, worlds, gas giants, belts, and moons, seed individual UWP digits, and let the engine fill in the rest. Available for MgT2E, CT, and T5 systems.
- **Interstellar Connectivity:** Automatic generation of X-boat trade lanes based on world Importance {Ix} scores.
- **Manual Routing:** Draw and color-code custom routes directly on the hex map across nine independent route slots — XBoat, Trade, and Secondary are pre-configured; the rest are yours to name, colour, and key however you like.
- **Point-to-Point Route Builder:** Chart a route through any number of mandatory waypoints — reorder stops freely, see each one's name and hex ID, and have every route slot remember its setup so you can reopen and extend a route later instead of rebuilding it. Stops can be **clicked straight off the map** rather than typed, either one field at a time or by tracing the whole route: each click extends it, with the previous destination becoming a waypoint. Stops may also be **empty hexes**, for referees who let players jump into deep space.
- **TravellerMap XML Integration:** Import and export TravellerMap-format metadata XML files — load route networks from community sector files directly into your route manager, or export your routes for use with TravellerMap and other tools.
- **Full TSV Export Fidelity:** Sector exports now correctly populate Ix, Ex, and Cx extension fields for Mongoose-generated worlds, using the engine's own computed socioeconomic values.
- **Regions:** Define named regions in the Region Manager (**G**), then assign them per-system in World Details or in bulk via right-click → Assign Region. Regions can be outlined and labelled on the map, and filtered on across all engines.
- **Cross-Engine Stellar Filtering:** Filter worlds by star class, spectral type, and subtype across all five generation engines (Classic Traveller, Mongoose 2E, Traveller 5, RTT, and AoW).
- **Full System Generation:** Dynamic stellar classification, gravity derivation, and automated moon/satellite inventory.
- **Regional Surface Maps:** Zoom from a world image down to one patch of the ground — a printable survey sheet with shaded relief, coastlines, named landforms, a graticule, scale bar, compass rose, globe locator and a terrain key giving each material's share of the sheet. The window is fixed at the world's own scale (roughly 120–220 km across), drag to pan or click the locator to jump, and every world carries five site slots you can **pin** to places worth surveying. Terrain is derived from the world's UWP and map seed, so the same world always renders the same landscape. Choose between two terrain models in **Settings → Visual Options → World Image Generation**: **Tectonic** (a plate model with linear ranges, trenches, rifts, rivers and lakes) or **Classic** (the original terrain, unchanged).
- **Wiki Export (Obsidian or HTML):** Package a subsector as a cross-linked **Obsidian** Markdown vault — a page per system, star, world, and moon — or as a standalone **HTML website** with one page per system, a sortable and filterable system index, light/dark themes, and print-ready pages. The HTML version needs no server or software beyond a browser; unzip and double-click. Both include the subsector map and world images, with a choice of projection — Globe (Hemispheres), Sinusoidal, Mercator, Mollweide, or Diamond. Worlds with pinned sites also get a **Regional Surveys** section carrying a full survey sheet per pin.
- **Players' Version (Fog of War):** Give each system a disclosure level — from *Unknown* (it does not appear at all) up through star presence, stellar details, gas giants, system layout, physical data and population, to the full UWP — then export a players' wiki trimmed to exactly that. Worlds stay unnamed until fully surveyed, orrery images are redrawn to match, and referee notes are never included. Set levels in bulk via right-click → **Assign Player Disclosure**, or open the **Player Disclosure** window (**D**) to see every system's level at a glance, with unreviewed systems flagged. The subsector map is drawn to match — undisclosed systems simply are not on it.

## Usage
1. **Launch the App:** Click the [Live Demo](https://bartlebythecoder.github.io/traveller_magnus/hex_map.html) link above.
2. **Import Data:** Click the settings gear (top right) → **Import / Export** → **Import Sector (.tsv)** to load a standard TravellerMap file. The same panel offers **Import the Imperium** (35 sectors) and **Import the Universe** (experimental, 128 sectors), both fetched live from travellermap.com.
    - **Save your work:** settings gear → **Map Files** → **Save Map JSON**. The browser keeps an automatic copy between sessions, but only the JSON survives a browser reset or moves between machines.
3. **Advanced Manual Routing:** Hold a route slot's shortcut key and drag between two adjacent hexes to draw a segment; repeating the drag over an existing segment deletes it. Slots are assigned keys **1–9** by default — **1** = XBoat (green), **2** = Trading (red), **3** = Secondary (yellow), **4–9** = spare slots. Names, colours, and shortcut keys are all editable in the Route Manager (**R**).
    - **Ctrl + Z / Ctrl + Shift + Z:** Undo and Redo cartography or expansion actions.
4. **View Details:** Use **Ctrl + Click** on any populated hex to open the **World Details** panel, which provides deep physical and socioeconomic breakdowns for the entire star system.
5. **System Viewer:** Zoom in with the scroll wheel; at maximum map zoom, one more scroll-in over a populated hex opens the animated orrery. Scroll out at full view or press **Escape** to return to the map.
6. **Bulk Macros:** Select a group of hexes (Shift+Drag) and use the right-click context menu or:
    - **Ctrl + Alt + M:** Full Mongoose 2E Generation sequence (includes system population).
    - **Ctrl + Alt + C:** Full Classic Traveller (Book 6) Generation sequence (includes system population).
    - **Ctrl + Alt + R:** Full RTT Generation sequence (includes system population).
    - **Ctrl + Alt + 5:** Full Traveller 5 (T5) Generation sequence (includes system population).
7. **Filter Control:** Use the **F Key** to **Open Filter Window** for advanced filtering and custom styling rules.
    - **Shift + F:** Temporarily suspend the filter so every world reappears, and press again to restore it. Your filter settings are untouched, and route generation keeps using the real filter regardless.

**Some quick notes on Importing the Universe**:
1) I have a one second wait time for each sector - so it takes a bit to load everything
2) Make sure to Save the JSON once you load it, so you never have to import it again - just load from your hard drive
3) It will be its most sluggish when zoomed out, and most responsive when zoomed in.
4) As of v0.8 this should be useable, though maybe sluggish, with older systems
5) Having all of these sectors loaded at once was not the intention of this program. I do, however, appreciate a challenge. So if you think you would enjoy working like this and have the right system for it, be my guest.

**Replacing Foreven**:
Want to replace any of these sectors with your own file?
1)  Mouse over the sector you want to replace (zoom in for smoother and better response results)
2)  Press Control + S to select the Sector (you should see it highlighted)
3)  Right Click->Populate->Manual Reset Clear (Note the sector # in the Clear Hex; 36 for Foreven)
4)  Click the settings gear in the top right and choose Import Sector .tsv
5)  Select your file - choose the sector number you noted (#36 for Foreven)

**Notes on Size Limits as of v0.8**:
1) 4GB RAM: Import the Universe freely. Expand systems via WBH for 8-10 sectors before risk. Ideal use case: full OTU political/astrographic view (T5 only) with a handful of deep-dived WBH sectors.
2) 8GB RAM: The Imperium (35 sectors) fully expanded is viable. The full Universe expanded is not.
3) 16GB RAM: Half the Universe expanded is realistic for a patient user.
4) 32-64GB RAM: The full Universe expanded is theoretically possible.

---
## 📜 Changelog

### [v0.18.2] - 2026-11-10
1. **New — Use Climate Codes:** a new setting under Settings → Visual Options → World Image Generation lets a T5 world's climate code shape its Tectonic world image and regional maps (Tr or Ho draws it Hot, Tu or Co Cold, and Fr Frozen, with its seas frozen solid); it starts on for new maps and off for maps saved before this version, so their worlds look exactly as before until you tick it.
2. **Improved — Frozen worlds with air:** with Use Climate Codes ticked, a frozen world that has an atmosphere, in any edition, is no longer drawn with the craters of an airless moon.
3. **New — T5 Twilight Zone worlds:** with Use Climate Codes ticked, a T5 Tz world with an atmosphere is drawn as T5 describes it, with desert Baked Lands on the side facing its star, ice-bound Frozen Lands on the far side and a 1,000 km Twilight ring between them that keeps its seas and coasts, in its world image, flat map and regional maps alike.
4. **Fixed — Very large maps:** maps of roughly 500 MB or more can now be saved, generated in and undone, where all three used to fail with "Failed to save file" or silently do nothing, and maps big enough to save in parts are now split by size so no single part grows too large to write.
5. **New — Custom OTU Import:** a new **Custom OTU Import** button in Settings shows a scrolling map of the 400 TravellerMap sectors with world data in the Official Traveller Universe and up the Zhodani Core Route, and you drag a rectangle over the ones you want to import them onto a canvas of that size, with an estimate of the file size and download time, a warning to confirm above 128 sectors and a limit of 400.

### [v0.18.1.4.1] - 2026-11-08
1. **Fixed — hex grids on very large worlds:** exported world images of planets of size G and above, such as T5 Big Worlds, now show their hex grid in HTML and Obsidian exports, where it was missing.

### [v0.18.1.4] - 2026-11-08
1. **New — White Background images:** the System Sheet, the orrery and regional survey sheets now follow the White Background Mode setting, both in the app and in HTML and Obsidian exports.
2. **Fixed — White Background world images:** exported world images and downloaded flat maps now have a white background instead of a transparent one when White Background Mode is on.
3. **New — Subsector names:** right-click any hex and choose **ASSIGN → Name Subsector…** to name its subsector; names are saved with the map, and maps saved before this version load as before with none named.
4. **New — Show Subsector Names:** a new toggle in Settings → Visual Options draws each subsector's name large and diagonally across it, in the style of the sector names, and keeps it showing, fainter and behind the worlds, when you zoom in past the point where sector names disappear.
5. **New — Imported subsector names:** TravellerMap imports bring in each sector's published subsector names when the new *Subsector Names* option is ticked.
6. **Improved — Subsector names in exports:** HTML and Obsidian subsector pages show the name in their headings, while file names and links stay "Subsector A".
7. **Fixed — Chunked saves:** maps large enough to save in parts now keep their sector names, route slots, borders and regions when reloaded.
8. **Fixed — Sector names after a refresh:** loading a map file now updates the autosave, so refreshing the browser no longer brings back the previous map's sector names.
9. **New — Add Border:** a new **Add Border** button in the Border Manager adds an empty border whenever you want one, so you are no longer limited to five until they are all in use.
10. **Fixed — T5 Twilight Zone worlds:** planets in Orbit 0 or 1 now carry the Tz code instead of a Tropic, Tundra or Frozen code, matching their "Twilight Zone (Tz)" climate.
11. **Fixed — T5 locked moons:** a mainworld in a Close orbit around its planet now shows as tidally locked to it instead of "Undefined".
12. **New — T5 satellite orbits:** every T5 satellite now has an orbit from Book 3's Chart 2C (Close orbits Ay to Em, Far orbits En to Zee), shown as "Orbit: Dee (D)" in the orrery, the hex accordion, the System Sheet and HTML and Obsidian exports.
13. **Fixed — T5 Far mainworld orbits:** a mainworld in a Far orbit around its planet now gets a Far orbit instead of a Close one.
14. **New — T5 mainworld parents:** a mainworld that is a satellite now rolls whether it orbits a gas giant or a planet, as Chart 2C's GG? column says.
15. **New — T5 Close moons:** every other moon is now placed in a Close or Far orbit, and Close moons are tidally locked to their planet and carry Lk.
16. **Changed — T5 Sa code:** Sa now appears only on a mainworld that is a satellite.
17. **Changed — T5 generation:** because of these new rolls, a T5 system generated from the same seed now comes out differently; saved maps are not affected.
18. **Fixed — T5 gas giant count:** the PBG gas giant count now matches the gas giants actually in the system, including the one a mainworld orbits and leaving out any that could not be placed in an orbit.
19. **Fixed — T5 belt count:** the PBG belt count now matches the planetoid belts actually in the system, including a belt mainworld, instead of coming from a separate roll.
20. **Fixed — T5 Tropic, Tundra and Frozen codes:** a mainworld now gets Tr, Tu or Fr only when its size, atmosphere and hydrographics meet Book 3's Chart D as well as its orbit, so belts and most other worlds no longer carry them.
21. **New — T5 Hot and Cold remarks:** a mainworld one orbit inside the habitable zone that does not qualify for Tr now carries Ho, and one orbit outside that does not qualify for Tu carries Co.
22. **Changed — T5 Climate Zone:** a T5 world's Climate Zone now follows its climate code (Twilight Zone for Tz, Hot / Tropic for Tr or Ho, Cold / Tundra for Tu or Co, Frozen for Fr) and is blank when it has none, so moons no longer all read "Hot / Tropic" and maps saved earlier show the same.
23. **Fixed — T5 brown dwarfs:** a brown dwarf's habitable zone is now Orbit 0, where the generator had treated it as a B star with its habitable zone at Orbit 9.
24. **Fixed — T5 gas giants and belts:** gas giants and belts no longer show a Climate Zone in the hex accordion or in HTML and Obsidian exports (including maps saved earlier), and a belt mainworld no longer carries a Tz, Ho or Co code.
25. **Fixed — T5 repeatable generation:** generating a T5 hex again with the same seed now gives the same system every time, where its planets and moons used to change depending on what else had been generated that session.
26. **Changed — T5 Rotation:** a tidally locked T5 world's Rotation now reads "Tidally Locked to Star (no day/night cycle)" or "Tidally Locked to Parent (day = orbit length)", including in maps saved earlier, with any hand-typed Rotation kept as typed.
27. **Fixed — T5 System Editor moon mainworld:** a new moon set as mainworld in the System Editor now rolls Close or Far like any other moon (2D, 7 or less Close), where it was always Far.
28. **New — T5 climate for every world:** every T5 planet and moon now gets its own Chart D climate code (Tr, Tu, Fr, Ho or Co, with moons using their planet's orbit) and the matching Climate Zone, in newly generated systems and in any system saved again from the System Editor.
29. **Fixed — T5 System Editor moon order:** a moon set as mainworld in the System Editor now keeps its place in its planet's moon list instead of moving to the end.
30. **Fixed — T5 moons in the orrery:** T5 moons are now drawn in order of their orbit letter, Ay innermost to Zee outermost with Close moons inside Far ones, where they were drawn in list order and could show a Far moon inside a Close one.
31. **Fixed — export world image hex grids:** CT, T5 and RTT planet images in HTML and Obsidian exports now show their hex grid in the Sinusoidal and Diamond projections, and their regional survey sheets now use the planet's real size, where both treated every such planet as size 0.
32. **New — World Details from the right-click menu:** with one hex selected, the right-click menu now has a WORLD DETAILS entry beside EDIT SYSTEM that opens the same World Details panel as Ctrl+click, which still works.
33. **Changed — T5 size-0 planets:** a size-0 planet no longer rolls moons, though any moon you place on one in the System Editor is kept.
34. **Fixed — T5 orrery moon speed:** moons of a size-0 world no longer whip around it about a hundred times too fast.

### [v0.18.1.3] - 2026-10-19
1. **Improved — one System Sheet per star:** each sheet now shows only the bodies orbiting one star, so a companion's planets no longer appear among the primary's at the wrong distances.
2. **New — companion star sheets:** a companion with its own bodies is marked on the strip with a body count; click it (or use the star buttons above the sheet) to switch to its sheet, and **Home** returns to the primary.
3. **New — companion sheets in exports:** HTML and Obsidian exports add "Name (hex) Star B.jpg" for each companion with bodies, under the same *Full UWP* rule as the main sheet.
4. **Fixed — AoW:** planets are now filed under the right star in the orrery, sheet and exports (circumbinary disks with the first star of their pair), and each companion's distance is read from its own orbit.
5. **Fixed — AoW planet names:** newly generated planets take the letter of, and are listed in the accordion under, the star they actually orbit (a planet of star C was named "B-XII"); existing saves keep their names.
6. **New — animated orrery GIFs:** **GIF** in the system view records the orrery as an animated GIF using your current view, speed and display settings, for a length in seconds or one full orbit of the mainworld.
7. **New — Import a Neighbourhood:** pick any sector and import it with its eight neighbours onto a 3×3 canvas, with borders, regions and xboat routes joined up across all nine.
8. **Fixed — OTU import cache:** Import the Universe (and Import a Neighbourhood) no longer wipe their own 24-hour download cache, so a repeat import loads in under a second instead of re-downloading every sector.
9. **Fixed — route shortcut keys:** **b**, **g** and **d** can no longer be assigned as route shortcuts, since they open the Border, Region and Player Disclosure windows.
10. **Changed — Load Sector Solo 6** now asks before replacing your current map.

### [v0.18.1.2] - 2026-10-01
1. **New — choose your system images on export:** HTML and Obsidian exports can include the system sheet, the orrery, both or neither; players' exports still show the sheet only at *Full UWP*.

### [v0.18.1.1] - 2026-09-25
1. **New — System Sheet:** **System Sheet** in the system view opens a one-page image of the whole system (rendered bodies in orbit order, star details, planetary table, mainworld called out) with **Download PNG**; all five engines.
2. **New — System Sheet in exports:** HTML and Obsidian exports use the sheet (JPEG) in place of the orrery; players' exports show it only at *Full UWP* and keep the orrery below that.
3. **Changed — CT world images now use each world's temperature** in every view; about two in three will look different.
4. **Fixed — RTT:** gas giant hover no longer fails, moons show UWPs, Red-zone lunar mainworlds read Red.
5. **Improved — T5:** hovering a body shows its Orbit #.

### [v0.18.1] - 2026-09-24
1. **Fixed — survey sites pinned on a moon now reach your exports**, under **Regional Surveys**, withheld from players' exports exactly as the moon's own image is.
2. **Housekeeping — about 220 lines of unused river code removed** from the terrain engine; nothing you see changes.
3. **Improved — round-trip routes list and export in travel order:** a clean circular Point-to-Point route is numbered from your Start in the Route Systems panel and the CSV export, and a straight route now lists from the Start you typed.

### [v0.18.0] - 2026-09-20
1. **New — regional surface maps:** **Open Map → Regional Maps** renders a printable survey sheet of any patch of a world's surface, with five pinnable sites per world that save with the sector and appear in the HTML and Obsidian exports.
2. **New — Tectonic or Classic terrain:** **Settings → World Image Generation** chooses between plate-tectonic continents and the classic model; the choice saves with the sector, and older files load as Classic so nothing you have changes.
3. **New — round-trip Point-to-Point routes:** Start and End may be the same world; use two or more waypoints for a genuine loop.
4. **Improved — generating a route now asks before replacing the route already in that slot.**
5. **Fixed — the MgT2E System accordion no longer opens blank** on multi-star systems from pre-v0.14 sector files.

---
*For a full history of changes, see the [Changelog](changelog.md).*

---
This tool is an unofficial fan project and is not affiliated with Mongoose Publishing or Far Future Enterprises. All Traveller trademarks and copyrights are used under fair use for fan-created content.
---
*Created by BIAS-CCR. Dedicated to the explorers of the Third Imperium and beyond.*

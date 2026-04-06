---
tags:
aliases:
links:
  - "[[traveller_series_ttrpg]]"
---
Created:  2026-04-02 16:48
Last modified: 2026-04-02 16:48

----
# RTT Worldgen

The RTT Complicated Star System Generator is a detailed, but not _too_ detailed, random star system and world generation system for Mongoose Traveller. It attempts to walk that fine line between realistic (as based on current astronomical and planetological research) and easy to use. Drawn from a number of sources, including the core rules, _GURPS Space_ (for 4th edition), _GURPS Traveller: First In_, various idea seeds on the [Traveller Mailing List](http://traveller.wikia.com/wiki/Traveller_Mailing_List) and [Citizens of the Imperium fora](http://www.travellerrpg.com/CotI/Discuss/), and the [Arc Builder Planetary Classification List](http://arcbuilder.home.bresnan.net/PCLMaster.html).

This is a "bottom up" system, where you start with the primary star and work through all the planetary orbits. However, a lot of the process has been greatly simplified and fudged, mainly so you don't have to go crazy calculating the molecular weight of the atmosphere and the effects of axial tilt, but also to make it easier to update the system when new scientific discoveries make it outdated. The end results are all in the conventional UPP format, with the addition of a single new rating, **Biosphere**, to describe the complexity of life on the world.

I've made the assumption that minor bodies aren't worth mentioning. Assume all systems have a Kuiper belt and Oort cloud, that most Jovians will have their Trojans and Greeks, and that pretty much any planet at all has a number of minor satellites, meteor clouds, etc. Space is big.

– Shadowjack

## To Do List

Special Features, internal links for dice tables, descriptive links for planetary and stellar classes, nomenclature/layout sheet

A: B-cdef-ghjk-Lm N N N P

A — Orbit

B — World Type

C — Size

D — Atmosphere

E — Hydrosphere

F — Biosphere

G — Population

H — Government Type

J — Law Level

K — Industrial Base

L — Starport

m — Bases

N — World & Trade Codes

P — Travel Code

  
Playtesting Notes:

12 Dec 2008: Minor tweaks.

19 June 2008: Improved population rules. Needs testing.

9 June 2008: Still working on the population rules. A high stellar society like the Imperium turns out a _lot_ of small outposts, which is mildly surprising, but does seem reasonable. Need a more elegant approach to terraforming; maybe this will work…

Gov. and Law codes seem to work, but definitely need to tweak the Industrial Base generation. Some tweaking to the base rules.

6 June 2008: The tables seem to turn out rather small planetary systems, especially for the ubiquitous red dwarfs, but I'm not sure that's a bug; if anything, it makes it easier to cope. And considering that we still don't know how common planets _really_ are in the universe; under these rules, the Sol system is neither rare nor typical, which works for me. If you want more planets, try applying DM +1 to the three orbit rolls. Microscopic life is fairly common and macroscopic life less so, which seems a reasonable assumption for Traveller, and there look to be plenty of quiet lifeless worlds suitable for terraforming.

## Basic Star Placement

Any hex has a 50% chance of having a brown dwarf (class L) somewhere.

Any hex has a 50% chance of having a star system somewhere.

A hex can contain both, drifting far apart from each other. For either kind of system, follow the procedure below.

## Star System Generation

### Number of Stars

Roll 3d6. **DMs:** Open Cluster +3. Don't roll for a lone brown dwarf; it's always solitary.

3-10 — Solitary star

11-15 — Binary system

16+ — Trinary system

### Spectral Types

For the Primary, roll 2d6.

For each Companion, roll and add 1d6-1 to the Primary's number.

_This generates a main sequence star; if the star later turns out to be a subgiant or giant, its spectral type will be changed. Don't roll for lone brown dwarfs._

2 — A-type or larger. (You may choose to place an O or B star, supergiant, etc.; max. 1 per sector.)

3 — F-type

4 — G-type

5 — K-type

6-13 — M-type

14+ — L-type

### System Age & Luminosity Classes

System Age = 3d6-3 (in billions of years). Use this to determine the luminosity class and final spectral type of each star.

**A-type**

If Age ≤ 2: A-V

If Age = 3, roll 1d6:

1-2 — F-IV

3 — K-III

4-6 — D

If Age ≥ 4: D

**F-type**

If Age ≤ 5: F-V

If Age = 6, roll 1d6:

1-4 — G-IV

5-6 — M-III

If Age ≥ 7: D

**G-type**

If Age ≤ 11: G-V

If Age 12-13, roll 1d6:

1-3 — K-IV

4-6 — M-III

If Age ≥ 14: D

**K-type**

Automatically K-V.

**M-type**

Roll 2d6. **DMs:** Companion star +2.

2-9 — M-V

10-12 — M-Ve (flare star)

13+ — L

**L-type**

Automatically L.

### Companion Orbits

For each Companion, roll 1d6:

1-2 — Tight orbit

3-4 — Close orbit

5 — Moderate orbit

6 — Distant orbit

## Planetary System Generation

Each Primary and Distant Companion has its own planetary system, consisting of:

**Epistellar orbits:** 1d6-3, maximum 2. **DMs:** M-V star -1.

_Type III, D, or L star:_ automatically 0.

**Inner Zone orbits:** 1d6-1. **DMs:** M-V star -1. If Close Companion present, automatically 0.

_Type L star:_ instead roll 1d3-1.

**Outer Zone orbits:** 1d6-1. **DMs:** M-V or L star -1. If Moderate Companion present, automatically 0.

### Orbit Contents

For each planetary orbit, roll 1d6. **DMs:** L star -1.

0-1 — Asteroid Belt

2 — Dwarf Planet

3 — Terrestrial Planet

4 — Helian Planet

5-6 — Jovian Planet

Then determine if the planets have any major satellites. (Small satellites are not counted.)

**Asteroid Belt**

Roll 1d6.

1-4 — All members are Small Bodies.

5-6 — Most members are Small Bodies, but there is also one Dwarf Planet.

**Dwarf Planet**

Roll 1d6.

1-5 — No major satellites.

6 — One Dwarf Planet as binary companion.

**Terrestrial Planet**

Roll 1d6.

1-4 — No major satellites.

5-6 — One Dwarf Planet as satellite.

**Helian Planet**

Satellites: 1d6-3. If there are any satellites at all, roll 1d6.

1-5 — All satellites are Dwarf Planets.

6 — One of the satellites is a Terrestrial Planet, and the others are Dwarf Planets.

**Jovian Planet**

Satellites: 1d6. Then, roll 1d6 again.

1-5 — All satellites are Dwarf Planets.

6 — Roll 1d6 again.

1-5 — One of the satellites is a Terrestrial Planet, and the others are Dwarf Planets.

6 — One of the satellites is a Helian Planet, and the others are Dwarf Planets.

Rings: Roll 1d6.

1-4 — Minor ring system only.

5-6 — Complex ring system.

### World Types

Then for each planet, look up its zone and type on the tables below to find out which world generation type to use.

If the star is type III or D, the first 1d6 orbits (counting outward) were directly affected by the star's expansion. Any planets in those orbits are automatically of a particular type:

All Dwarf Planets become Stygian.

All Terrestrial Planets become Acheronian.

All Helian Planets become Asphodelian.

All Jovian Planets become Chthonian.

  

#### Dwarf Planets

##### Epistellar

Roll 1d6. **DMs:** Asteroid Belt member -2.

1-3 — Rockball

4-5 — Meltball

6 — Roll 1d6:

1-4 — Hebean

5-6 — Promethean

##### Inner Zone

Roll 1d6. **DMs:** Asteroid Belt member -2, Helian satellite +1, Jovian satellite +2.

1-4 — Rockball

5-6 — Arean

7 — Meltball

8 — Roll 1d6:

1-4 — Hebean

5-6 — Promethean

##### Outer Zone

Roll 1d6. **DMs:** Asteroid Belt member -1, Helian satellite +1, Jovian satellite +2.

0 — Rockball

1-4 — Snowball

5-6 — Rockball

7 — Meltball

8 — Roll 1d6:

1-3 — Hebean

4-5 — Arean

6 — Promethean

#### Terrestrial Planets

##### Epistellar

Roll 1d6.

1-4 — JaniLithic

5 — Vesperian

6 — Telluric

##### Inner Zone

Roll 2d6.

2-4 — Telluric

5-6 — Arid

7 — Tectonic

8-9 — Oceanic

10 — Tectonic

11-12 — Telluric

##### Outer Zone

Roll 1d6. **DMs:** Satellite +2.

1-4 — Arid

5-6 — Tectonic

7-8 — Oceanic

#### Helian Planets

##### Epistellar

Roll 1d6.

1-5 — Helian

6 — Asphodelian

##### Inner Zone

Roll 1d6.

1-4 — Helian

5-6 — Panthalassic

##### Outer Zone

Automatically Helian.

#### Jovian Planets

##### Epistellar

Roll 1d6.

1-5 — Jovian

6 — Chthonian

##### Inner Zone

Automatically Jovian.

##### Outer Zone

Automatically Jovian.

## World Generation

### World Generation Tables

#### Acheronian

_Terrestrial Group, Telluric Class, Acheronian Type._  
These are worlds that were directly affected by their primary's transition from the main sequence; the atmosphere and oceans have been boiled away, leaving a scorched, dead planet.

Size: 1d6+4.

Atmosphere: 1.

Hydrosphere: 0.

Biosphere: 0.

#### Arean

_Dwarf Group, GeoCyclic Class, Arean / Utgardian / Titanian Types._  
These are worlds with little liquid, that move through a slow geological cycle of a gradual build-up, a short wet and clement period, and a long decline.

Size: 1d6-1.

Atmosphere: Roll 1d6. **DMs:** D star -2.

1-3 — 1.

4-6 — A.

Hydrosphere: 2d6+Size-7. **DMs:** Atmos 1 -4.

Biosphere:

_Chemistry:_ Roll 1d6. **DMs:** L star +2; Outer Zone +2.

1-4 — Water (Age modifier +0) _[Arean]_

5-6 — Ammonia (Age modifier +1) _[Utgardian]_

7-8 — Methane (Age modifier +3) _[Titanian]_

If Age ≥ 1d3 + modifier, and Atmos 1: 1d6-4.

If Age ≥ 1d3 + modifier, and Atmos A: 1d3.

If Age ≥ 4 + modifier, and Atmos A: 1d6+Size-2.

Otherwise: 0.

**it should be noted that the current Hydrosphere dice calculations may conjure results that do not match this planet-type; perhaps a 1d6 or 2d3 roll would be better, since 2d6 can lead to a roll above the 9 number of the Hydrosphere Scale below

#### Arid

_Terrestrial Group, Arid Class, Darwinian / Saganian / Asimovian Types._  
These are worlds with limited amounts of surface liquid, that maintain an equilibrium with the help of their tectonic activity and their biosphere.

Size: 1d6+4.

Biosphere:

_Chemistry:_ Roll 1d6. **DMs:** K-V star +2; M-V star +4; L star +5; Outer Zone +2.

1-6 — Water (Age modifier +0) _[Darwinian]_

7-8 — Ammonia (Age modifier +1) _[Saganian]_

9-10 — Methane (Age modifier +3) _[Asimovian]_

If Age ≥ 1d3 + modifier: 1d3.

If Age ≥ 4 + modifier: 2d6. **DMs:** D star -3.

Otherwise: 0.

Atmosphere:

If Biosphere 3+ and Water Chemistry: 2d6-7+Size, minimum 2, maximum 9.

Otherwise: A.

Hydrosphere: 1d3.

#### Asphodelian

_Helian Group, GeoHelian Class, Asphodelian Type._  
These are worlds that were directly affected by their primary's transition from the main sequence; their atmosphere has been boiled away, leaving the surface exposed.

Size: 1d6+9.

Atmosphere: 1.

Hydrosphere: 0.

Biosphere: 0.

#### Chthonian

_Jovian Group, Chthonian Class._  
These are worlds that were directly affected by their primary's transition from the main sequence, or that have simply spent too long in a tight epistellar orbit; their atmospheres have been stripped away.

Size: G.

Atmosphere: 1.

Hydrosphere: 0.

Biosphere: 0.

#### Hebean

_Dwarf Group, GeoTidal Class, Hebean / Idunnian Types._  
These are highly active worlds, due to tidal flexing, but with some regions of stability; the larger ones may be able to maintain some atmosphere and surface liquid.

Size: 1d6-1.

Atmosphere: 1d6+Size-6.

If 2+: change to A.

Hydrosphere: 2d6+Size-11.

Biosphere: 0.

#### Helian

_Helian Group, GeoHelian / Nebulous Classes._  
These are typical helian or "subgiant" worlds – large enough to retain helium atmospheres.

Size: 1d6+9.

Atmosphere: D.

Hydrosphere: Roll 1d6.

1-2 — 0.

3-4 — 2d6-1.

5-6 — F.

Biosphere: 0.

#### JaniLithic

_Terrestrial Group, Epistellar Class, JaniLithic Type._  
These worlds, tide-locked to the primary, are rocky, dry, and geologically active.

Size: 1d6+4.

Atmosphere: Roll 1d6.

1-3 — 1

4-6 — A

Hydrosphere: 0.

Biosphere: 0.

#### Jovian

_Jovian Group. If life-bearing, is most likely DwarfJovian Class, Brammain / Khonsonian Types._  
These are huge worlds with helium-hydrogen envelopes and compressed cores; the largest emit more heat than they absorb.

Size: G.

Atmosphere: G.

Hydrosphere: G.

Biosphere: Roll 1d6. **DMs:** Inner Zone +2.

1-5 — 0

6 — Life is possible.

If Age ≥ 1d6: 1d3.

If Age ≥ 7: 2d6. **DMs:** D star -3.

Otherwise: 0.

_Chemistry:_ If life, roll 1d6. **DMs:** L star +1; Epistellar -2; Outer Zone +2.

1-3 — Water _[Brammian]_

4-6 — Ammonia _[Khonsonian]_

#### Meltball

_Dwarf Group, GeoThermic Class, Phaethonic / Apollonian / Sethian Types, or GeoTidal Class, Hephaestian / Lokian Types._  
These are dwarfs with molten or semi-molten surfaces, either from extreme tidal flexing, or extreme approach to a star.

Size: 1d6-1.

Atmosphere: 1.

Hydrosphere: F.

Biosphere: 0.

#### Oceanic

_Terrestrial Group, Oceanic Class, Pelagic / Nunnic / Teathic Types, or Tectonic Class, BathyGaian / BathyAmunian / BathyTartarian Types._  
These are worlds with a continuous hydrological cycle and deep oceans, due to either dense greenhouse atmosphere or active plate tectonics.

Size: 1d6+4.

Biosphere:

_Chemistry:_ Roll 1d6. **DMs:** K-V star +2; M-V star +4; L star +5; Outer Zone +2.

1-6 — Water (Age modifier +0) _[Pelagic / BathyGaian]_

7-8 — Ammonia (Age modifier +1) _[Nunnic / BathyAmunian]_

9-10 — Methane (Age modifier +3) _[Teathic / BathyTartarian]_

If Age ≥ 1d3 + modifier: 1d3.

If Age ≥ 4 + modifier: 2d6. **DMs:** D star -3.

Otherwise: 0.

Atmosphere:

If Water Chemistry: 2d6+Size-6, minimum 1, maximum C. **DMs:** K-V star -1; M-V star -2; L star -3; any IV star -1.

Otherwise: Roll 1d6.

1 — 1

2-4 — A

5-6 — C

Hydrosphere: B.

#### Panthalassic

_Helian Group, Panthalassic Class._  
These are massive worlds, aborted gas giants, largely composed of water and hydrogen.

Size: 1d6+9.

Atmosphere: 1d6+8, maximum D.

Hydrosphere: B.

Biosphere:

_Chemistry:_ Roll 1d6. **DMs:** K-V star +2; M-V star +4; L star +5.

1-6 — Roll 2d6.

2-8 — Water (Age modifier +0)

9-11 — Sulfur (Age modifier +0)

12 — Chlorine (Age modifier +0)

7-8 — Methane (Age modifier +1)

9-10 — Methane (Age modifier +3)

If Age ≥ 1d3 + modifier: 1d3.

If Age ≥ 4 + modifier: 2d6.

Otherwise: 0.

#### Promethean

_Dwarf Group, GeoTidal Class, Promethean / Burian / Atlan Types._  
These are worlds that, through tidal-flexing, have a geological cycle similar to plate tectonics, that supports surface liquid and atmosphere.

Size: 1d6-1.

Biosphere:

_Chemistry:_ Roll 1d6. **DMs:** L star +2; Epistellar -2; Outer Zone +2.

1-4 — Water (Age modifier +0) _[Promethean]_

5-6 — Ammonia (Age modifier +1) _[Burian]_

7-8 — Methane (Age modifier +3)_[Atlan]_

If Age ≥ 1d3 + modifier: 1d3.

If Age ≥ 4 + modifier: 2d6. **DMs:** D star -3.

Otherwise: 0.

Atmosphere:

If Biosphere 3+ and Water Chemistry: 2d6+Size-7, minimum 2, maximum 9.

Otherwise: A.

Hydrosphere: 2d6-2.

#### Rockball

_Dwarf Group, GeoPassive Class, Ferrinian / Lithic / Carbonian Types._  
These are mostly dormant worlds, with surfaces largely unchanged since the early period of planetary formation.

Size: 1d6-1.

Atmosphere: 0.

Hydrosphere: 2d6+Size-11. **DMs:** L star +1; Epistellar -2, Outer Zone +2.

Biosphere: 0.

#### Small Body

_Small Body Group._  
These are bodies too small to sustain hydrostatic equilibrium; nearly all asteroids and comets are small bodies.

Size: 0 (or Y for an entire Asteroid Belt).

Atmosphere: 0.

Hydrosphere: 0.

Biosphere: 0.

#### Snowball

_Dwarf Group, GeoPassive Class, Gelidian Type, or GeoThermic Class, Erisian Type, or GeoTidal Class, Plutonian Type._  
These worlds are composed of mostly ice and some rock. They may have varying degrees of activity, ranging from completely cold and still to cryo-volcanically active with extensive subsurface oceans.

Size: 1d6-1.

Atmosphere: Roll 1d6.

1-4 — 0

5-6 — 1

Hydrosphere: Roll 1d6.

1-3 — A (entirely frozen)

4-6 — 2d6-2 (represents subsurface oceans)

Biosphere:

_Chemistry:_ Roll 1d6. **DMs:** L star +2; Outer Zone +2.

1-4 — Water (Age modifier +0)

5-6 — Ammonia (Age modifier +1)

7-8 — Methane (Age modifier +3)

If subsurface oceans, and Age ≥ 1d6: 1d6-3.

If subsurface oceans, and Age ≥ 6 + modifier: 1d6+Size-2.

Otherwise: 0.

#### Stygian

_Dwarf Group, GeoPassive Class, Stygian Type._ These are worlds that were directly affected by their primary's transition from the main sequence; they are melted and blasted lumps.

Size: 1d6-1.

Atmosphere: 0.

Hydrosphere: 0.

Biosphere: 0.

#### Tectonic

_Terrestrial Group, Tectonic Class, Gaian / Amunian / Tartarian Types._  
These are worlds with active plate tectonics and large bodies of surface liquid, allowing for stable atmospheres and a high likelihood of life.

Size: 1d6+4.

Biosphere:

_Chemistry:_ Roll 1d6. **DMs:** K-V star +2; M-V star +4; L star +5; Outer Zone +2.

1-6 — Roll 2d6.

2-8 — Water (Age modifier +0) _[Gaian]_

9-11 — Sulfur (Age modifier +0) _[ThioGaian]_

12 — Chlorine (Age modifier +0) _[ChloriticGaian]_

7-8 — Ammonia (Age modifier +1) _[Amunian]_

9-10 — Methane (Age modifier +3) _[Tartarian]_

If Age ≥ 1d3 + modifier: 1d3.

If Age ≥ 4 + modifier: 2d6. **DMs:** D star -3.

Otherwise: 0.

Atmosphere:

If Biology 3+ and Water Chemistry: 2d6+Size-7, minimum 2, maximum 9.

If Biology 3+ and Sulfur or Chlorine Chemistry: B.

Otherwise: A.

Hydrosphere: 2d6-2.

#### Telluric

_Terrestrial Group, Telluric Class, Phosphorian / Cytherean Types._  
These are worlds with geoactivity but no hydrological cycle at all, leading to dense runaway-greenhouse atmospheres.

Size: 1d6+4.

Atmosphere: C.

Hydrosphere: Roll 1d6.

1-4 — 0.

5-6 — F.

Biosphere: 0.

#### Vesperian

_Dwarf Group, Epistellar Class, Vesperian Type._  
These worlds are tide-locked to their primary, but at a distance that permits surface liquid and the development of life.

Size: 1d6+4.

Biosphere:

_Chemistry:_ Roll 2d6.

2-11 — Water

12 — Chlorine

If Age ≥ 1d3: 1d3.

If Age ≥ 4: 2d6.

Otherwise: 0.

Atmosphere:

If Biosphere 3+ and Water Chemistry: 2d6+Size-7, minimum 2, maximum 9.

If Biosphere 3+ and Chlorine: B.

Otherwise: A.

Hydrosphere: 2d6-2.

### Revised Planetary Profile Codes

#### Size

0 — ≤800 km, neg. gravity

1 — 1,600 km, 0.05 G

2 — 3,200 km, 0.15 G (Triton, Luna, Europa)

3 — 4,800 km, 0.25 G (Mercury, Ganymede)

4 — 6,400 km, 0.35 G (Mars)

5 — 8,000 km, 0.45 G

6 — 9,600 km, 0.70 G

7 — 11,200 km, 0.9 G

8 — 12,800 km, 1.0 G (Terra)

9 — 14,400 km, 1.25 G

A — ≥16,000 km, ≥1.4 G

B-E — Helian sizes

G — Jovian sizes

X — Planetary-Mass Artifact

Y — Asteroid Belt

#### Atmosphere

0 — Vacuum

1 — Trace

2 — Very Thin Tainted

3 — Very Thin Breathable

4 — Thin Tainted

5 — Thin Breathable

6 — Standard Breathable

7 — Standard Tainted

8 — Dense Breathable

9 — Dense Tainted

A — Exotic

B — Corrosive

C — Insidious

D — Super-High Density

G — Gas Giant Envelope

#### Hydrosphere

0 — ≤5% (Trace)

1 — ≤15% (Dry / tiny ice caps)

2 — ≤25% (Small seas / ice caps)

3 — ≤35% (Small oceans / large ice caps)

4 — ≤45% (Wet)

5 — ≤55% (Large oceans)

6 — ≤65%

7 — ≤75% (Terra)

8 — ≤85% (Water world)

9 — ≤95% (No continents)

A — ≤100% (Total coverage)

B — Superdense (incredibly deep world oceans)

F — Intense Volcanism (molten surface)

G — Gas Giant Core

#### Biosphere

0 — Sterile

1 — Building Blocks (amino acids, or equivalent)

2 — Single-celled organisms

3 — Producers (atmosphere begins to transform)

4 — Multi-cellular organisms

5 — Complex single-celled life (nucleic cells, or equivalent)

6 — Complex multi-cellular life (microscopic animals)

7 — Small macroscopic life

8 — Large macroscopic life

9 — Simple global ecology (life goes out of the oceans and onto land or into the air, etc.)

A — Complex global ecology

B — Proto-sapience

C — Full sapience

D — Trans-sapience (able to deliberately alter their own evolution, minimum Tech Level C)

If Biosphere C or more, this is a Homeworld; proceed to the Population tables.

#### Population

0 — Uninhabited

1 — Few

2 — Hundreds

3 — Thousands

4 — Tens of thousands

5 — Hundreds of thousands

6 — Millions

7 — Tens of millions

8 — Hundreds of millions

9 — Billions

A — Tens of billions

B — Hundreds of billions

C — Trillions

Includes all sapients.

#### Government

0 — None (tends toward family/clan/tribal)

1 — Company or corporation

2 — Participatory democracy

3 — Self-perpetuating oligarchy

4 — Representative democracy

5 — Feudal technocracy

6 — Captive government (colony or conquered territory)

7 — Balkanized

8 — Civil service bureaucracy

9 — Impersonal bureaucracy

A — Charismatic dictator

B — Non-charismatic dictator

C — Charismatic oligarchy

D — Theocracy

E — Supreme authority

F — Hive-mind collective

#### Law Level

0 — No restrictions

1 — Only restrictions upon WMD and other dangerous technologies

2-4 — Light restrictions: heavy weapons, narcotics, alien technology

5-7 — Heavy restrictions: most weapons, specialized tools and information, foreigners

8+ — Extreme restrictions: extensive monitoring and limitations, free speech curtailed

#### Industry Level

Measures level of local production and support, not highest level known.

0 — No industry. Everything must be imported.

1-3 — Primitive. Mostly only raw materials made locally.

4-6 — Industrial. Local tools maintained, some produced.

7-9 — Pre-Stellar. Production and maintenance of space technologies.

A-B — Early Stellar. Support for A.I. and local starship production.

C-E — Average Stellar. Support for terraforming, flying cities, clones.

F — High Stellar. Support for highest of the high tech.

### Populations

If a world has Biosphere C+, it is the homeworld of a sapient race. Otherwise, you will have to determine if anyone has placed a colony or outpost on this world. To do this, you will need to know:

_Settlement._ How long this region of space has been settled by starfaring cultures, in centuries. Minimum 0 for recently-explored regions. In the Imperium, some sectors have been settled for millenia; subtract 3d6 centuries for the effects of the Long Night.

_Tech Level (TL)._ The highest Tech Level of the dominant starfaring culture. The Imperium and its neighbors have TL15. Jump capability requires TL10 or higher; a TL9 culture can slowly colonize other stars with using sub-light ships; a TL8 culture can colonize its own system only; a TL7- culture cannot expand beyond its homeworld.

#### World Desirability

Whether or not starfarers take interest in a world depends on its Desirability score, calculated as follows. These rules are are humans and similar lifeforms; other sophonts may prefer other kinds of worlds, and so should have different rules.

##### Asteroid Belts

For each belt, roll 1d6-1d6, and apply the following DMs:

- _Flare Star_ – M-Ve star: **-1d3**
- _Lifebelt_ – Inner Zone orbit: further detailed needed
    - Any giant, brown dwarf, or white dwarf: **+0**
    - M-V star: **+1**
    - Any other dwarf or subgiant: **+2**

##### Dwarfs, Terrestrials, Helians, and Jovians

For each such world, add up all the factors which apply:

- _Dry World_ – Hydro 0: **-1**
- _Extreme Environment_ – Size D+; or Atmos C-G; or Hydro F: **-2**
- _Flare Star_ – M-Ve star: **-1d3**
- _Habitable World_ – Size 1-B, Atmos 2-9, and Hydro 0-B: further detail needed
    - _Garden World_ – Size 5-A, Atmos 4-9, and Hydro 4-8: **+5**
    - _Water World_ – Hydro A-B: **+3**
    - _Poor World_ – Atmos 2-6, and Hydro 0-3: **+2**
    - Otherwise: **+4**
- _High Gravity_ – Size A+ and Atmos F-: **-1**

_Note: Yes, normal Jovians don't count as "high gravity", as one doesn't live on the surface._

- _Lifebelt_ – Inner Zone orbit: further detail needed
    - Any giant, brown dwarf, or white dwarf: **+0**
    - M-V star: **+1**
    - Any other dwarf or subgiant: **+2**
- _Tiny World_ – Size 0: **-1**
- _T-Prime Atmosphere_ – Atmos 6 or 8: **+1**

###### Terraforming

At Tech Level 10+, any Inner Zone world with Size 1-B and Atmosphere 1-D, and _not_ Hydro F, may be terraformed. For each such world, take (TL+Settlement-15) OR (TL+1d6-15) points, whichever is more. You may add these points to or subtract them from the world's Atmosphere, Hydrosphere, or Biosphere codes, in order to improve their Desirability ratings.

If you want to introduce Earthly bioforms to a world with alternative biochemistry, you first have to exterminate the existing life by reducing the Biosphere to 2 or less, _then_ increase it.

Other suggested limits on terraforming:

Worlds with Hydro F cannot be terraformed, period.

Worlds with Hydro B cannot be reduced below Hydro B. There's just too much ocean.

Worlds with Atmos B or C and Hydro 2+ cannot be reduced below Atmos B, unless you first reduce them to Hydro 1 or less. After converting the atmosphere, you may add water seas, increasing Hydro normally.

Worlds with native populations cannot be terraformed without genocide – and the natives will resist. Treat population as another code to modify, and reduce it to 1 or less before continuing.

Roll to see if there's an outpost first; if there is, terraforming may proceed. Then roll to see if there's a colony after terraforming.

#### Habitation

The Population, and resulting Government, Law, and Industry codes, depend on the type of habitation.

- If a world has Biosphere C+, it is the homeworld of an intelligent species.
- For each world that is not a homeworld, roll 2d6-2. If you roll less than or equal to the world's Desirability score, then a colony has been placed there. (No colonies will be placed on worlds with Desirability less than 0.)
- For each world that is not a homeworld or colony, roll 1d6, -1 in a culture's home system. If you roll less than or equal to (TL-9), then an outpost has been placed there.

##### Homeworld

Population:

If normal carbon/water-based life: Desirability+1d3-1d3.

Other forms of life: 2d6.

Government:

If native TL 0: 0.

If native TL 1+, then roll 1d6:

If roll ≤ (native TL)-9: 7.

Otherwise: Population+2d6-7.

##### Colony

Population: TL+Settlement-9, minimum 4, maximum = Desirability+1d3-1d3.

Government: Population+2d6-7.

If the world is habitable (Size 1-B, Atmos 2-9) and has no major pre-existing lifeforms (Biosphere 2-), the colonists will seed the world with friendly lifeforms, raising the local Biosphere to 1d6+5.

##### Outpost

Population: 1d3+Desirability, maximum 4.

If Population = 0, there is only an automated beacon, listening post, emergency cache, etc., but no permanent population.

Government:

If Population 0: 0.

Otherwise: Population+2d6-7, maximum 6.

##### Uninhabited

Population: 0.

Government: 0.

#### Other Population Stats

**Law Level**  

If Government 0: 0.

Otherwise: Government+2d6-7.

**Industrial Base**  

If Population 0: 0.

Otherwise: Population+2d6-7. **DMs:** Law 1-3 +1; Law 6-9 -1; Law A-C -2; Law D+ -3; +1 if world is unsafe for human habitation (Atmos 0-4, 7, 9+; or Hydro F); TL 12-14 +1; TL15+ +2.

#### The Effects of Local Industry

A world's Industrial Base affects its statistics as follows:

Industry 0: Population -1.

Industry 4-9: Population +1, Atmosphere modified as follows:

Atmos 3 becomes Atmos 2.

Atmos 5 becomes Atmos 4.

Atmos 6 becomes Atmos 7.

Atmos 8 becomes Atmos 9.

Industry A+: Choose one of the following:

_a)_ Population +1, or

_b)_ Population +2, and modify Atmosphere as above.

##### Hard Times

In a Long Night scenario, worlds are cut off from galactic trade and forced to rely upon their own technology. Colonies on unsafe worlds which have less than the required minimum Industrial Base have to be abandoned; reduce Population to 0, leaving ruins behind.

Atmosphere 4, 7, or 9 requires Industry 3+ to maintain filter production or air purification.

Atmosphere 2 or 3 requires Industry 5+ to maintain respirator production.

Atmosphere 0, 1, or A requires Industry 8+ to maintain the pressure habitats.

Atmosphere B or D requires Industry 9+ to maintain high-pressure or corrosion-resistant habitats.

Atmosphere C or G, or Hydrosphere F, requires Industry A+ to maintain deep-pressure or aerostat habitats.

Outposts on unsafe worlds _might_ be maintained. If there's a colony or homeworld nearby, make a roll at _their_ Jump level, and if successful, the outpost remains. Otherwise, it too must be abandoned.

If you want to get really complicated, than for any terraformed planet during Hard Times, _reverse_ the terraforming effects by points equal to half the difference between the local Industrial Base and the old galactic Tech Level (e.g. if you were at TL12, and are now at TL8, you lose 4 points of terraforming).

#### Interstellar Trade

##### Trade Codes

_Agricultural (Ag):_ Atmos 4-9, Hydro 4-8, Pop 5-7.

_Asteroid Belt (As):_ Asteroid Belt.

_Desert (De):_ Atmos 2-D, Hydro 0.

_Fluid Oceans (Fl):_ Atmos A+ or non-water biochemistry, Hydro 1-B.

_Garden (Ga):_ Size 5-A, Atmos 4-9, Hydro 4-8.

_High Population (Hi):_ Pop 9+.

_High Technology (Ht):_ Industry (TL-3)+.

_Ice-Capped (Ic):_ Atmos 0-1, Hydro 1+.

_Industrial (In):_ Pop 9+, Industry 6+.

_Low Population (Lo):_ Pop 1-3.

_Low Technology (Lt):_ Industry 5-.

_Non-Agricultural (Na):_ Atmos 0-3 or B+, Hydro 0-3 or B+, Pop 6+.

_Non-Industrial (Ni):_ Pop 4-6.

_Poor (Po):_ Atmos 2-5, Hydro 0-3.

_Rich (Ri):_ Atmos 6 or 8, Pop 6-8.

_Sterile (St):_ Bio 0.

_Water World (Wa):_ Atmos 2+, Hydro A-B.

_Vacuum (Va):_ Atmos 0.

_Zoo (Zo):_ Bio 7+.

##### Starport

Roll 2d6+Industry-7. **DMs:** Ag +1, Ga +1, Hi +1, Ht +1, In +1, Na +1, Ri +1, TL12-14 +1, TL15+ +2, Lo -1, Po -1, TL9- -1.

≤2 — X

3-4 — E

5-6 — D

7-8 — C

9-10 — B

11≤ — A

An Outpost world with Population 0 automatically has the equivalent of an E-class starport, in the form of an unmanned navigation beacon and emergency supply cache.

Any world with Industry 5+ must have at least the equivalent of an E-class starport, in its airstrips or surface shipping ports.

Any uninhabitable world with Population 1+ must have at least the equivalent of an E-class starport, in its airlocks and docking ports.

##### Bases

Roll 2d6 for all of these.

**Ancients Site (Q)**

Per system: Throw 12+. If present, select a world at random.

**Imperial Consulate, Governor's Estate (G)**

Starport A: Throw 6+.

Success by 3+ means also a foreign embassy or diplomatic consulate (F).

Success by 6+ means also a Moot seat or other government center.

Any Capital automatically has Starport A and government center.

Starport B: Throw 8+.

Success by 3+ means also a foreign embassy or diplomatic consulate (F).

Starport C: Throw 10+.

**Merchant Base (M)**

Starport A: Throw 6+.

Success by 3+ means also a shipyard (Y).

Success by 6+ means also a megacorporate headquarters.

Starport B: Throw 8+.

Success by 3+ means also a shipyard (Y).

Starport C: Throw 10+.

**Naval Base (N)**

Starport A, B, or C: Throw 8+.

Success by 3+ means also a shipyard or galactic hospital (Y or H).

**Pirate Base (P)**

Starport B: Throw 12+.

Starport C: Throw 10+.

Starport D or E: Throw 12+.

**Psionics Institute (Z)**

Any inhabited world: Throw 12+.

**Research Installation (R)**

Starport A: Throw 8+

Success by 3+ means also a galactic hospital, university or library archive (H, U, or L).

Starport B or C: Throw 10+.

Outpost: Throw 9+.

Success by 3+ means also a backup library archive (L).

**Sacred Site (K)**

Any inhabited world: Roll 2d6 ≤ Pop.

**Scout Base (S)**

Starport A: Throw 10+.

Starport B or C: Throw 8+.

Success by 3+ means also a scout hostel.

Starport D: Throw 7+.

Success by 3+ means also a scout hostel.

**Special Enclave, Nature Preserve, Prison (V)**

Any world with Pop 1+ or Bio 1+: Throw 10+.

**Traveller's Aid Society Hostel (T)**

Starport A: Throw 4+.

Success by 3+ means first-class accommodations.

Success by 6+ means a full chapter-house.

Starport B: Throw 6+.

Success by 3+ means first-class accommodations.

Starport C: Throw 10+.

**Weather Control Station, Terraforming Facility (W)**

Any terraformed world: Automatic.

###### Base Codes

**A** — A-class (Excellent) Starport

**B** — B-class (Good) Starport

**C** — C-class (Routine) Starport

**D** — D-class (Poor) Starport

**E** — E-class (Frontier) Starport or Emergency Beacon

**F** — Foreign Embassy / Diplomatic Consulate

**G** — Imperial Consulate / Governor's Estate

**H** — Galactic Hospital

**J** — Ansible / Stargate

**K** — Galactic church, temple, or other religious site

**L** — Library Archive

**M** — Merchant / Megacorporate base

**N** — Naval base

**P** — Pirate base

**Q** — Ancients' site

**R** — Research installation

**S** — Scout base

**T** — Travellers' Aid Society Hostel

**U** — Galactic University

**V** — Special enclave (prison, refugee facility, nature preserve, etc.)

**W** — Weather control / terraforming facility

**X** — No starport

**Y** — Shipyard

**Z** — Psionics Institute

[Category](https://wiki.rpg.net/index.php/Special:Categories "Special:Categories"): 

- [Traveller](https://wiki.rpg.net/index.php/Category:Traveller "Category:Traveller")

## Navigation menu

- Not logged in
- [Talk](https://wiki.rpg.net/index.php/Special:MyTalk "Discussion about edits from this IP address [alt-shift-n]")
- [Contributions](https://wiki.rpg.net/index.php/Special:MyContributions "A list of edits made from this IP address [alt-shift-y]")
- [Create account](https://wiki.rpg.net/index.php?title=Special:CreateAccount&returnto=RTT+Worldgen "You are encouraged to create an account and log in; however, it is not mandatory")
- [Log in](https://wiki.rpg.net/index.php?title=Special:UserLogin&returnto=RTT+Worldgen "You are encouraged to log in; however, it is not mandatory [alt-shift-o]")

- [Page](https://wiki.rpg.net/index.php/RTT_Worldgen "View the content page [alt-shift-c]")
- [Discussion](https://wiki.rpg.net/index.php/Talk:RTT_Worldgen "Discussion about the content page [alt-shift-t]")

- [Read](https://wiki.rpg.net/index.php/RTT_Worldgen)
- [Edit](https://wiki.rpg.net/index.php?title=RTT_Worldgen&action=edit "Edit this page [alt-shift-e]")
- [View history](https://wiki.rpg.net/index.php?title=RTT_Worldgen&action=history "Past revisions of this page [alt-shift-h]")

### Search

[](https://wiki.rpg.net/index.php/Main_Page "Visit the main page")

- [RPGnet](http://www.rpg.net/)
- [Main Page](https://wiki.rpg.net/index.php/Main_Page "Visit the main page [alt-shift-z]")
- [Major Projects](https://wiki.rpg.net/index.php/Major_Projects "About the project, what you can do, where to find things")
- [Categories](https://wiki.rpg.net/index.php/Special:Categories "Find background information on current events")
- [Recent changes](https://wiki.rpg.net/index.php/Special:RecentChanges "A list of recent changes in the wiki [alt-shift-r]")
- [Random page](https://wiki.rpg.net/index.php/Special:Random "Load a random page [alt-shift-x]")
- [Help](https://www.mediawiki.org/wiki/Special:MyLanguage/Help:Contents "The place to find out")

### Tools

- [What links here](https://wiki.rpg.net/index.php/Special:WhatLinksHere/RTT_Worldgen "A list of all wiki pages that link here [alt-shift-j]")
- [Related changes](https://wiki.rpg.net/index.php/Special:RecentChangesLinked/RTT_Worldgen "Recent changes in pages linked from this page [alt-shift-k]")
- [Special pages](https://wiki.rpg.net/index.php/Special:SpecialPages "A list of all special pages [alt-shift-q]")
- Printable version
- [Permanent link](https://wiki.rpg.net/index.php?title=RTT_Worldgen&oldid=318943 "Permanent link to this revision of this page")
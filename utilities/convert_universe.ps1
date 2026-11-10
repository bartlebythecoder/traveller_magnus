# convert_universe.ps1
# Fetches OTU sector list from the travellermap API and generates js/universe_data.js.
# Covers the full 16x8 canvas:
#   X: -8 (Sidiadl/spinward edge) to  7 (Treece/trailing edge)
#   Y: -3 (coreward edge)         to  4 (rimward edge)
#
# Also writes window.OTU_SECTOR_MAP: every OTU- or ZCR-tagged sector with world data
# inside the Custom OTU picker's window (X -23..14, Y -175..17), with its tags, for the
# drag-a-rectangle import.
#
# Re-run whenever you need fresh data from travellermap.

# The script lives in utilities/, so js/ is one level up.
$scriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Definition
$repoRoot   = Split-Path -Parent $scriptDir
$outputFile = Join-Path $repoRoot "js\universe_data.js"

# ---- Grid bounds (must match the 16x8 Universe canvas) ----
# Y in travellermap coords: negative = coreward (up), positive = rimward (down)
# Top-left:     Sidiadl  (-8, -3)   Bottom-right: Treece (7, 4)
$X_MIN  = -8
$X_MAX  =  7
$Y_MIN  = -3
$Y_MAX  =  4
$GRID_W = 16   # columns in the Universe canvas

Write-Host "Fetching sector list from travellermap.com/api/universe ..."

# milieu=M1105 restricts to the standard Third Imperium 1105 dataset,
# preventing duplicate entries for sectors that exist in other milieus.
try {
    $data = Invoke-RestMethod -Uri "https://travellermap.com/api/universe?milieu=M1105" -TimeoutSec 30
} catch {
    Write-Host "ERROR: API call failed: $_"
    exit 1
}

# The API wraps sectors under different keys depending on the response shape.
$allSectors = $null
if ($data.Sectors)                              { $allSectors = $data.Sectors }
elseif ($data.Universe -and $data.Universe.Sectors) { $allSectors = $data.Universe.Sectors }

if (-not $allSectors) {
    Write-Host "ERROR: Could not locate Sectors array in response."
    Write-Host "Top-level keys: $($data.PSObject.Properties.Name -join ', ')"
    exit 1
}

Write-Host "Universe contains $($allSectors.Count) total sector(s)."
Write-Host "Filtering to X:[$X_MIN, $X_MAX] Y:[$Y_MIN, $Y_MAX] ..."

$jsonItems = [System.Collections.Generic.List[string]]::new()

# Collect matching sectors, deduplicating by (X, Y).
$seen    = [System.Collections.Generic.HashSet[string]]::new()
$matched = [System.Collections.Generic.List[object]]::new()
foreach ($sector in $allSectors) {
    $sx  = [int]$sector.X
    $sy  = [int]$sector.Y
    $key = "$sx,$sy"
    if ($sx -ge $X_MIN -and $sx -le $X_MAX -and $sy -ge $Y_MIN -and $sy -le $Y_MAX) {
        if ($seen.Add($key)) {
            $matched.Add($sector)
        }
    }
}

# Sort in reading order (Y ascending, then X ascending).
$matchedArray = $matched | Sort-Object { [int]$_.Y }, { [int]$_.X }

foreach ($sector in $matchedArray) {
    # Resolve the primary English name.
    $name = ""
    if ($sector.Names -and $sector.Names.Count -gt 0) {
        $name = $sector.Names[0].Text
    } elseif ($sector.Name) {
        $name = $sector.Name
    }
    if ($name -eq "") { continue }

    $sx = [int]$sector.X
    $sy = [int]$sector.Y

    # Compute 1-based slot number for the 16x8 grid.
    $col  = $sx - $X_MIN
    $row  = $sy - $Y_MIN
    $slot = $row * $GRID_W + $col + 1

    $nameSafe = $name.Replace('\', '\\').Replace('"', '\"')
    $jsonItems.Add("{`"name`":`"$nameSafe`",`"x`":$sx,`"y`":$sy,`"defaultSlot`":`"$slot`"}")

    Write-Host ("  Slot {0,3}  ({1,3},{2,3})  {3}" -f $slot, $sx, $sy, $name)
}

if ($jsonItems.Count -eq 0) {
    Write-Host "ERROR: No sectors matched the grid bounds. Check API response format."
    exit 1
}

# ---- Custom OTU picker map: OTU and Zhodani Core Route sectors that have worlds ----
# requireData=1 drops sectors travellermap holds only a name for ("No world data
# available") -- 155 OTU-tagged sectors and every ZCR sector off its X=-7 spine.
# Tags is a space-separated list ("Official OTU", "InReview OTU", plain "OTU", "ZCR" ...).
# Other fan settings (OrionOB1, Faraway ...) are left out. The window reaches coreward
# to the end of the Zhodani Core Route (Y -175).
$MAP_X_MIN =  -23
$MAP_X_MAX =   14
$MAP_Y_MIN = -175
$MAP_Y_MAX =   17

try {
    $dataOnly = Invoke-RestMethod -Uri "https://travellermap.com/api/universe?milieu=M1105&requireData=1" -TimeoutSec 30
} catch {
    Write-Host "ERROR: API call (requireData) failed: $_"
    exit 1
}
$dataSectors = $null
if ($dataOnly.Sectors)                                  { $dataSectors = $dataOnly.Sectors }
elseif ($dataOnly.Universe -and $dataOnly.Universe.Sectors) { $dataSectors = $dataOnly.Universe.Sectors }
if (-not $dataSectors) {
    Write-Host "ERROR: Could not locate Sectors array in the requireData response."
    exit 1
}

$mapSeen  = [System.Collections.Generic.HashSet[string]]::new()
$mapItems = [System.Collections.Generic.List[string]]::new()
$mapSorted = $dataSectors | Sort-Object { [int]$_.Y }, { [int]$_.X }
foreach ($sector in $mapSorted) {
    $sx = [int]$sector.X
    $sy = [int]$sector.Y
    if ($sx -lt $MAP_X_MIN -or $sx -gt $MAP_X_MAX -or $sy -lt $MAP_Y_MIN -or $sy -gt $MAP_Y_MAX) { continue }
    $tags = [string]$sector.Tags
    if (-not (" $tags " -match ' (OTU|ZCR) ')) { continue }
    if (-not $mapSeen.Add("$sx,$sy")) { continue }
    $name = ""
    if ($sector.Names -and $sector.Names.Count -gt 0) { $name = $sector.Names[0].Text }
    elseif ($sector.Name) { $name = $sector.Name }
    if ($name -eq "") { continue }
    $nameSafe = $name.Replace('\', '\\').Replace('"', '\"')
    $tagsSafe = $tags.Replace('\', '\\').Replace('"', '\"')
    $mapItems.Add("{`"name`":`"$nameSafe`",`"x`":$sx,`"y`":$sy,`"tags`":`"$tagsSafe`"}")
}
Write-Host "Custom OTU map: $($mapItems.Count) OTU/ZCR sector(s) with world data in X:[$MAP_X_MIN, $MAP_X_MAX] Y:[$MAP_Y_MIN, $MAP_Y_MAX]."

$json    = "[" + [string]::Join(",", $jsonItems) + "]"
$mapJson = "[" + [string]::Join(",", $mapItems) + "]"
$content = "// Auto-generated by convert_universe.ps1 - do not edit manually.`r`n"
$content += "// Source: travellermap.com/api/universe  Grid: X[$X_MIN,$X_MAX] Y[$Y_MIN,$Y_MAX] (16x8)`r`n"
$content += "window.UNIVERSE_SECTORS = $json;`r`n"
$content += "// Custom OTU picker: OTU and ZCR sectors with world data in X[$MAP_X_MIN,$MAP_X_MAX] Y[$MAP_Y_MIN,$MAP_Y_MAX]`r`n"
$content += "window.OTU_SECTOR_MAP_BOUNDS = { xMin: $MAP_X_MIN, xMax: $MAP_X_MAX, yMin: $MAP_Y_MIN, yMax: $MAP_Y_MAX };`r`n"
$content += "window.OTU_SECTOR_MAP = $mapJson;`r`n"

[System.IO.File]::WriteAllText($outputFile, $content, [System.Text.Encoding]::UTF8)

Write-Host ""
Write-Host "Done! Wrote js/universe_data.js ($($jsonItems.Count) sector(s), $($mapItems.Count) on the Custom OTU map)."

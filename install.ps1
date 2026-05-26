# CodeGraph standalone installer for Windows (PowerShell).
#
# Downloads a self-contained bundle (a vendored Node runtime + the app) from
# GitHub Releases. No Node.js, no build tools required.
#
#   irm https://raw.githubusercontent.com/colbymchenry/codegraph/main/install.ps1 | iex
#
# Upgrade with `codegraph upgrade` (or just re-run this). To uninstall: remove
# $env:LOCALAPPDATA\codegraph and drop its \current\bin entry from your user PATH.
#
# Environment:
#   CODEGRAPH_VERSION      release tag to install (default: latest)
#   CODEGRAPH_INSTALL_DIR  install location (default: %LOCALAPPDATA%\codegraph)
#   CODEGRAPH_DOWNLOAD_BASE release asset base URL
#                            (default: https://github.com/colbymchenry/codegraph/releases/download)

$ErrorActionPreference = 'Stop'
$repo = 'colbymchenry/codegraph'
$installDir = if ($env:CODEGRAPH_INSTALL_DIR) { $env:CODEGRAPH_INSTALL_DIR } else { Join-Path $env:LOCALAPPDATA 'codegraph' }
$downloadBase = if ($env:CODEGRAPH_DOWNLOAD_BASE) { $env:CODEGRAPH_DOWNLOAD_BASE.TrimEnd('/') } else { "https://github.com/$repo/releases/download" }

function Test-UnsafeInstallDir([string]$Path) {
  if (-not $Path) { return $true }
  $full = [System.IO.Path]::GetFullPath($Path).TrimEnd('\')
  $homeDir = [System.IO.Path]::GetFullPath($HOME).TrimEnd('\')
  $localAppData = if ($env:LOCALAPPDATA) { [System.IO.Path]::GetFullPath($env:LOCALAPPDATA).TrimEnd('\') } else { '' }
  $blocked = @(
    [System.IO.Path]::GetPathRoot($full).TrimEnd('\'),
    $homeDir,
    $localAppData,
    (Join-Path $env:SystemDrive '\Windows').TrimEnd('\'),
    (Join-Path $env:SystemDrive '\Program Files').TrimEnd('\'),
    (Join-Path $env:SystemDrive '\Program Files (x86)').TrimEnd('\')
  ) | Where-Object { $_ }
  return $blocked -contains $full
}

function Verify-ArchiveChecksum([string]$ArchivePath, [string]$AssetName, [string]$Version) {
  $sums = Join-Path (Split-Path $ArchivePath -Parent) 'SHA256SUMS'
  $sumsUrl = "$downloadBase/$Version/SHA256SUMS"
  try {
    Invoke-WebRequest -Uri $sumsUrl -OutFile $sums
  } catch {
    Write-Warning "checksum file unavailable; proceeding without SHA256 verification."
    return
  }
  $expected = $null
  foreach ($line in Get-Content $sums) {
    if ($line -match '^([0-9a-fA-F]{64})\s+\*?(.+)$' -and [System.IO.Path]::GetFileName($matches[2].Trim()) -eq $AssetName) {
      $expected = $matches[1].ToLowerInvariant()
      break
    }
  }
  if (-not $expected) {
    Write-Warning "$AssetName not listed in SHA256SUMS; proceeding without SHA256 verification."
    return
  }
  $actual = (Get-FileHash -Algorithm SHA256 $ArchivePath).Hash.ToLowerInvariant()
  if ($actual -ne $expected) {
    throw "codegraph: checksum mismatch for $AssetName (expected $expected, got $actual)"
  }
  Write-Host "Verified SHA256 for $AssetName"
}

if (Test-UnsafeInstallDir $installDir) {
  throw "codegraph: refusing unsafe CODEGRAPH_INSTALL_DIR '$installDir'. Choose a dedicated directory such as %LOCALAPPDATA%\codegraph."
}

# 1. Detect architecture -> target matching the release archives.
$arch = if ([System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture -eq 'Arm64') { 'arm64' } else { 'x64' }
$target = "win32-$arch"

# 2. Resolve the version (latest release unless pinned).
$version = $env:CODEGRAPH_VERSION
if (-not $version) {
  $version = (Invoke-RestMethod "https://api.github.com/repos/$repo/releases/latest").tag_name
}
if (-not $version) { throw "codegraph: could not resolve latest version; set CODEGRAPH_VERSION." }

# 3. Download + extract the bundle into a stable 'current' dir (overwritten on upgrade).
$asset = "codegraph-$target.zip"
$url = "$downloadBase/$version/$asset"
Write-Host "Installing CodeGraph $version ($target)..."
$tmp = Join-Path $env:TEMP ("cg-" + [guid]::NewGuid().ToString())
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
$zip = Join-Path $tmp 'cg.zip'
Invoke-WebRequest -Uri $url -OutFile $zip
Verify-ArchiveChecksum -ArchivePath $zip -AssetName $asset -Version $version

$dest = Join-Path $installDir 'current'
if (Test-Path $dest) { Remove-Item -Recurse -Force $dest }
New-Item -ItemType Directory -Force -Path $dest | Out-Null
Expand-Archive -Path $zip -DestinationPath $dest -Force
# Archives contain a top-level codegraph-<target>\ dir; flatten it.
$inner = Join-Path $dest "codegraph-$target"
if (Test-Path $inner) {
  Get-ChildItem -Force $inner | Move-Item -Destination $dest -Force
  Remove-Item -Recurse -Force $inner
}
Remove-Item -Recurse -Force $tmp

# 4. Put the launcher dir on the user's PATH.
$binDir = Join-Path $dest 'bin'
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if (($userPath -split ';') -notcontains $binDir) {
  [Environment]::SetEnvironmentVariable('Path', "$binDir;$userPath", 'User')
  Write-Host "Added $binDir to your PATH (restart your terminal to pick it up)."
}

Write-Host "Installed to $dest"

# 5. Warn if a different codegraph earlier on PATH will shadow this install.
# Most often a stale `npm i -g @colbymchenry/codegraph`, whose launcher keeps
# running its own version-pinned bundle — so `codegraph --version` disagrees
# with what we just installed (issue #1071). Check both the persisted PATH a
# fresh shell sees (Machine + User) and this session's PATH (catches dirs a
# shell profile injects, e.g. conda / npm).
$expected = Join-Path $binDir 'codegraph.cmd'
function Find-FirstCodegraph([string]$pathStr) {
  foreach ($dir in ($pathStr -split ';')) {
    if (-not $dir) { continue }
    foreach ($leaf in @('codegraph.cmd', 'codegraph.exe', 'codegraph.bat', 'codegraph.ps1')) {
      $cand = Join-Path $dir $leaf
      if (Test-Path -LiteralPath $cand) { return $cand }
    }
  }
  return $null
}
$machinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
$freshPath = ((@($machinePath, [Environment]::GetEnvironmentVariable('Path', 'User')) | Where-Object { $_ }) -join ';')
$shadow = $null
foreach ($winner in @((Find-FirstCodegraph $env:Path), (Find-FirstCodegraph $freshPath))) {
  if ($winner -and ($winner -ne $expected)) { $shadow = $winner; break }
}
if ($shadow) {
  Write-Warning "Another codegraph is earlier on your PATH and will run instead of this install:"
  Write-Warning "  $shadow"
  Write-Warning "  (this install: $expected)"
  Write-Warning "If 'codegraph --version' shows an unexpected version, remove the other copy"
  Write-Warning "(e.g. 'npm rm -g @colbymchenry/codegraph') or put '$binDir' first on your PATH."
}

Write-Host "Run: codegraph --help"

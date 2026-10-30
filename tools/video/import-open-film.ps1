# Public, explicitly CC-BY licensed Blender Studio asset. No accounts/cookies.
$ErrorActionPreference='Stop'
$starpetRoot=Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$starpetSource=Join-Path $starpetRoot 'output\open-movie-sources'
New-Item -ItemType Directory -Force -Path $starpetSource | Out-Null
$starpetOriginal=Join-Path $starpetSource 'llamigos-original.mp4'
if (-not (Test-Path -LiteralPath $starpetOriginal)) {
    & curl.exe -L --fail --silent --show-error --max-time 180 'https://studio.blender.org/download-source/files/26/263f328078fbebd508a0d3262f4fb4da5f16439f/263f328078fbebd508a0d3262f4fb4da5f16439f-1080p.mp4' -o $starpetOriginal
    if ($LASTEXITCODE -ne 0) { throw 'Publisher download failed' }
}
if ((Get-FileHash -LiteralPath $starpetOriginal -Algorithm SHA256).Hash -ne '826513349ECF02D83B22F414514704E3BBA10FF28FB45408A6CDF6CC57BACC06') { throw 'Source changed; review before adapting' }
$starpetLicense=Invoke-WebRequest -Uri 'https://studio.blender.org/projects/api/assets/2417/?site_context=featured_artwork' -TimeoutSec 25
if ($starpetLicense.Content -notmatch 'https://creativecommons.org/licenses/by/4.0/' -or $starpetLicense.Content -notmatch 'You are free to share and adapt this content') { throw 'Publisher license requires re-review' }
# The public player emits expiring signed read URLs. Store the license evidence,
# not those temporary URLs. The canonical download URL is in open-films.mjs.
$starpetEvidence=$starpetLicense.Content -replace 'https://studio\.blender\.org/files/[^"<> ]+', '[temporary playback URL omitted]'
Set-Content -LiteralPath (Join-Path $starpetSource 'llamigos-license.html') -Value $starpetEvidence -Encoding utf8
Write-Output 'Verified official original and CC BY 4.0 license evidence.'

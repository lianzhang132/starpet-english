param(
    [string]$BuildRoot = (Join-Path $env:LOCALAPPDATA 'StarPetEnglishBuild'),
    [string]$Python = 'python',
    [switch]$SkipLint
)
$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
foreach ($required in @("$env:JAVA_HOME/bin/java.exe", "$env:ANDROID_HOME/platforms/android-35/android.jar")) {
    if (-not (Test-Path -LiteralPath $required)) { throw "Missing build dependency: $required. Configure JAVA_HOME and ANDROID_HOME." }
}
# Use a separate ASCII junction for Windows Java test-worker argument files.
$buildPath = [IO.Path]::GetFullPath($BuildRoot)
if ($buildPath -match '[^\x00-\x7F]') { throw 'BuildRoot must use an ASCII path.' }
if (Test-Path -LiteralPath $buildPath) {
    $existing = Get-Item -LiteralPath $buildPath
    if ($existing.LinkType -ne 'Junction' -or [IO.Path]::GetFullPath($existing.Target) -ne [IO.Path]::GetFullPath($project)) {
        throw "BuildRoot is occupied by another target: $buildPath"
    }
} else {
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $buildPath) | Out-Null
    New-Item -ItemType Junction -Path $buildPath -Target $project | Out-Null
}
& $Python (Join-Path $PSScriptRoot 'export-curriculum.py')
if ($LASTEXITCODE -ne 0) { throw 'Curriculum export failed' }
Push-Location $project
try {
    & node --test server/tests/audio-pack.test.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Offline audio check failed' }
    $tasks = @('assemblePreview', 'testPreviewUnitTest')
    if (-not $SkipLint) { $tasks += 'lintPreview' }
    & (Join-Path $buildPath 'android/gradlew.bat') --no-daemon --console=plain -p (Join-Path $buildPath 'android') @tasks
    if ($LASTEXITCODE -ne 0) { throw 'Android build or verification failed' }
    Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $project 'android/app/build/outputs/apk/preview/app-preview.apk')
} finally { Pop-Location }

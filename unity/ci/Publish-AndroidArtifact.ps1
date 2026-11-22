$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ($env:GITHUB_REF -ne 'refs/heads/codex/unity-66-foundation' -or
    $env:GITHUB_REPOSITORY -ne 'omarpedersen1997-png/Touchline37-Game') {
    throw 'Artefakter maa kun afleveres fra den aftalte Unity-branch.'
}
if ($env:TOUCHLINE_BUILD_ID -notmatch '^[0-9]+-[0-9]+$') { throw 'Ugyldigt build-id.' }
$build = Join-Path $env:GITHUB_WORKSPACE ('unity/TouchlineUnity/Builds/CI/' + $env:TOUCHLINE_BUILD_ID)
$apk = Join-Path $build 'Touchline-Unity-Test.apk'
$infoPath = Join-Path $build 'build-info.json'
if (-not (Test-Path -LiteralPath $apk) -or -not (Test-Path -LiteralPath $infoPath)) {
    throw 'Unity leverede ikke baade APK og build-info.json.'
}
$info = Get-Content -LiteralPath $infoPath -Raw | ConvertFrom-Json
if ($info.commit -ne $env:TOUCHLINE_COMMIT -or $info.buildId -ne $env:TOUCHLINE_BUILD_ID -or
    $info.branch -ne $env:GITHUB_REF -or $info.unityVersion -ne '6000.6.10f1' -or
    $info.appId -ne 'dk.touchline.footballidle.unitytest' -or
    $info.versionCode -ne (1001 + [int]$env:TOUCHLINE_BUILD_NUMBER)) {
    throw 'APK-metadata passer ikke til den aktuelle Unity-koersel.'
}

# GitHub-hosted Linux has an Android SDK; Windows uses Unity's bundled SDK.
$sdk = $env:ANDROID_HOME
if ([string]::IsNullOrWhiteSpace($sdk)) { $sdk = $env:ANDROID_SDK_ROOT }
if ($env:OS -eq 'Windows_NT') {
    $editor = $env:UNITY_EDITOR_PATH
    if ([string]::IsNullOrWhiteSpace($editor)) {
        $editor = 'C:\Program Files\Unity\Hub\Editor\6000.6.10f1\Editor\Unity.exe'
    }
    $androidPlayer = Join-Path (Split-Path -Parent $editor) 'Data/PlaybackEngines/AndroidPlayer'
    $sdk = Join-Path $androidPlayer 'SDK'
    $env:JAVA_HOME = Join-Path $androidPlayer 'OpenJDK'
}
if ([string]::IsNullOrWhiteSpace($sdk)) { throw 'Android SDK mangler til APK-verifikation.' }
$tools = Get-ChildItem -LiteralPath (Join-Path $sdk 'build-tools') -Directory |
    Where-Object { $_.Name -match '^\d+\.\d+\.\d+$' } |
    Sort-Object { [version]$_.Name } -Descending | Select-Object -First 1
if ($null -eq $tools) { throw 'Android build-tools mangler.' }
$signerName = 'apksigner'; $aaptName = 'aapt'
if ($env:OS -eq 'Windows_NT') { $signerName = 'apksigner.bat'; $aaptName = 'aapt.exe' }
$signature = & (Join-Path $tools.FullName $signerName) verify --verbose --print-certs $apk
if ($LASTEXITCODE -ne 0) { throw 'APK-signaturen er ugyldig.' }
$badging = & (Join-Path $tools.FullName $aaptName) dump badging $apk
if ($LASTEXITCODE -ne 0) { throw 'Android-pakken kan ikke laeses.' }
$expected = "package: name='dk.touchline.footballidle.unitytest' versionCode='" + $info.versionCode + "'"
if (-not (($badging -join "`n").Contains($expected))) { throw 'APK har forkert app-id/versionCode.' }

$stage = Join-Path $env:RUNNER_TEMP 'touchline-unity-artifact'
if (Test-Path -LiteralPath $stage) { throw 'Artefaktmappe findes allerede; overskriver ikke.' }
New-Item -ItemType Directory -Path $stage | Out-Null
$hash = (Get-FileHash -LiteralPath $apk -Algorithm SHA256).Hash.ToLowerInvariant()
Copy-Item -LiteralPath $apk -Destination $stage
Copy-Item -LiteralPath $infoPath -Destination $stage
Set-Content -LiteralPath (Join-Path $stage 'SHA256SUMS.txt') -Value ($hash + '  Touchline-Unity-Test.apk') -Encoding UTF8
Set-Content -LiteralPath (Join-Path $stage 'certificate.txt') -Value $signature -Encoding UTF8
$bytes = (Get-Item -LiteralPath $apk).Length
@(
    '### Touchline Unity Android TEST',
    '',
    ('- Unity: **' + $info.unityVersion + '**'),
    ('- Commit: `' + $info.commit + '`'),
    ('- APK: **' + [math]::Round($bytes / 1000000, 2) + ' MB** (' + $bytes + ' bytes)'),
    ('- SHA-256: `' + $hash + '`'),
    ('- Testsignering: **' + $info.signingKind + '**. ephemeral-debug skifter signatur ved naeste koersel; bevar eksisterende app/save.'),
    '- Verificeret: signatur, app-id, versionCode og build-metadata.',
    '- Ikke verificeret: installation, opstart og FPS paa fysisk Android.',
    '- Download ZIP under Artifacts; udpak og installer Touchline-Unity-Test.apk.',
    '- Dette er den separate Unity-testapp, ikke en opdatering af Capacitor TEST eller APK 37.'
) | Add-Content -LiteralPath $env:GITHUB_STEP_SUMMARY -Encoding UTF8

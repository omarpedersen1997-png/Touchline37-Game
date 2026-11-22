param([switch]$ExportForGameCi)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if ($env:GITHUB_REF -ne 'refs/heads/codex/unity-66-foundation' -or
    $env:GITHUB_REPOSITORY -ne 'omarpedersen1997-png/Touchline37-Game') {
    throw 'Kun den aftalte Unity-branch maa oprette testsignering.'
}
if ($env:TOUCHLINE_BUILD_ID -notmatch '^[0-9]+-[0-9]+$') { throw 'Ugyldigt build-id.' }
$key = Join-Path $env:RUNNER_TEMP ('touchline-unity-' + $env:TOUCHLINE_BUILD_ID + '.keystore')
if (Test-Path -LiteralPath $key) { throw 'CI-noeglen findes allerede; overskriver ikke.' }
$keytool = $null
if ($env:OS -eq 'Windows_NT') {
    $editor = $env:UNITY_EDITOR_PATH
    if ([string]::IsNullOrWhiteSpace($editor)) { $editor = 'C:\Program Files\Unity\Hub\Editor\6000.6.10f1\Editor\Unity.exe' }
    $keytool = Join-Path (Split-Path -Parent $editor) 'Data/PlaybackEngines/AndroidPlayer/OpenJDK/bin/keytool.exe'
} else {
    $found = Get-Command keytool -ErrorAction SilentlyContinue
    if ($null -ne $found) { $keytool = $found.Source }
}
if ([string]::IsNullOrWhiteSpace($keytool) -or -not (Test-Path -LiteralPath $keytool)) {
    throw 'OpenJDK/keytool mangler. Installer Unity Android Build Support med OpenJDK.'
}
$stdout = Join-Path $env:RUNNER_TEMP ('touchline-keytool-' + $env:TOUCHLINE_BUILD_ID + '.out')
$stderr = Join-Path $env:RUNNER_TEMP ('touchline-keytool-' + $env:TOUCHLINE_BUILD_ID + '.err')
$created = $false
try {
    $kind = 'persistent-debug'
    if ([string]::IsNullOrWhiteSpace($env:UNITY_ANDROID_DEBUG_KEYSTORE_BASE64)) {
        $kind = 'ephemeral-debug'
        $generate = @('-genkeypair', '-noprompt', '-storetype', 'JKS', '-keystore', ('"' + $key + '"'),
            '-alias', 'androiddebugkey', '-keyalg', 'RSA', '-keysize', '3072', '-validity', '10000',
            '-storepass', 'android', '-keypass', 'android', '-dname', '"CN=Touchline Unity TEST, O=OPNext Games, C=DK"')
        $process = Start-Process -FilePath $keytool -ArgumentList $generate -Wait -PassThru -NoNewWindow -RedirectStandardOutput $stdout -RedirectStandardError $stderr
        if ($process.ExitCode -ne 0) { throw 'Midlertidig debug-signering kunne ikke oprettes.' }
    } else {
        [IO.File]::WriteAllBytes($key, [Convert]::FromBase64String($env:UNITY_ANDROID_DEBUG_KEYSTORE_BASE64))
    }
    $created = $true
    $check = @('-list', '-keystore', ('"' + $key + '"'), '-storepass', 'android', '-alias', 'androiddebugkey')
    $process = Start-Process -FilePath $keytool -ArgumentList $check -Wait -PassThru -NoNewWindow -RedirectStandardOutput $stdout -RedirectStandardError $stderr
    if ($process.ExitCode -ne 0) { throw 'Debug-keystore skal bruge alias androiddebugkey og debug-password android.' }
    $env:TOUCHLINE_DEBUG_KEYSTORE_PATH = $key
    $env:TOUCHLINE_SIGNING_KIND = $kind
    if ($ExportForGameCi) {
        if ([string]::IsNullOrWhiteSpace($env:GITHUB_OUTPUT)) { throw 'GitHub step-output mangler.' }
        $encoded = [Convert]::ToBase64String([IO.File]::ReadAllBytes($key))
        Write-Output ('::add-mask::' + $encoded)
        @('keystore_base64=' + $encoded, 'signing_kind=' + $kind) | Add-Content -LiteralPath $env:GITHUB_OUTPUT -Encoding UTF8
    }
    if ($kind -eq 'ephemeral-debug') {
        Write-Warning 'Midlertidig signatur: naeste koersel bruger en anden noegle. Afinstaller aldrig en eksisterende Unity-testapp uden save-backup. En vedvarende Secret er fortsat valgfri.'
    }
    Write-Output ('Touchline testsignering: ' + $kind)
} catch {
    if ($created -and (Test-Path -LiteralPath $key)) { Remove-Item -LiteralPath $key -Force }
    throw
} finally {
    foreach ($file in @($stdout, $stderr)) { if (Test-Path -LiteralPath $file) { Remove-Item -LiteralPath $file -Force } }
}

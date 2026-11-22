# Executes safe failure paths only: no Unity invocation, keystore or APK needed.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$scripts = Get-ChildItem -LiteralPath (Join-Path $root 'unity/ci') -Filter '*.ps1'
$passed = 0
foreach ($script in $scripts) {
    $tokens = $null; $issues = $null
    [System.Management.Automation.Language.Parser]::ParseFile($script.FullName, [ref]$tokens, [ref]$issues) | Out-Null
    if ($issues.Count) { throw ($issues | Out-String) }
    $passed++
    foreach ($context in @(
        @{ Repo = 'omarpedersen1997-png/Touchline37-Game'; Ref = 'refs/heads/main' },
        @{ Repo = 'someone/fork'; Ref = 'refs/heads/codex/unity-66-foundation' }
    )) {
        $env:GITHUB_REPOSITORY = $context.Repo; $env:GITHUB_REF = $context.Ref
        $rejected = $false
        try { & $script.FullName }
        catch {
            if ($_.Exception.Message -notlike '*Unity-branch*') { throw }
            $rejected = $true
        }
        if (-not $rejected) { throw ('Branch guard failed: ' + $script.Name) }
        $passed++
    }
}
$env:GITHUB_REPOSITORY = 'omarpedersen1997-png/Touchline37-Game'
$env:GITHUB_REF = 'refs/heads/codex/unity-66-foundation'
$env:UNITY_ANDROID_DEBUG_KEYSTORE_BASE64 = ''
$previousEditor = $env:UNITY_EDITOR_PATH
$env:UNITY_EDITOR_PATH = '/missing/Touchline-Unity.exe'
try { & (Join-Path $root 'unity/ci/Build-Windows.ps1'); throw 'Missing editor accepted' }
catch { if ($_.Exception.Message -notlike '*Unity 6000.6.10f1 mangler*') { throw } }
$env:UNITY_EDITOR_PATH = $previousEditor
$passed++
$env:TOUCHLINE_BUILD_ID = '../escape'
try { & (Join-Path $root 'unity/ci/Publish-AndroidArtifact.ps1'); throw 'Invalid id accepted' }
catch { if ($_.Exception.Message -ne 'Ugyldigt build-id.') { throw } }
$passed++
$work = Join-Path ([IO.Path]::GetTempPath()) ('touchline-signing-test-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $work | Out-Null
try {
    $env:RUNNER_TEMP = $work
    $env:TOUCHLINE_BUILD_ID = '2001-1'
    & (Join-Path $root 'unity/ci/New-DebugSigning.ps1') 3>$null | Out-Null
    if ($env:TOUCHLINE_SIGNING_KIND -ne 'ephemeral-debug') { throw 'Missing secret did not generate a key' }
    $first = [IO.File]::ReadAllBytes($env:TOUCHLINE_DEBUG_KEYSTORE_PATH)
    $firstHash = (Get-FileHash -LiteralPath $env:TOUCHLINE_DEBUG_KEYSTORE_PATH).Hash
    $passed++
    $env:UNITY_ANDROID_DEBUG_KEYSTORE_BASE64 = [Convert]::ToBase64String($first)
    $env:TOUCHLINE_BUILD_ID = '2001-2'
    & (Join-Path $root 'unity/ci/New-DebugSigning.ps1') | Out-Null
    if ($env:TOUCHLINE_SIGNING_KIND -ne 'persistent-debug' -or (Get-FileHash -LiteralPath $env:TOUCHLINE_DEBUG_KEYSTORE_PATH).Hash -ne $firstHash) { throw 'Optional persistent signing changed' }
    $passed++
    $env:UNITY_ANDROID_DEBUG_KEYSTORE_BASE64 = ''
    $env:TOUCHLINE_BUILD_ID = '2001-3'
    & (Join-Path $root 'unity/ci/New-DebugSigning.ps1') 3>$null | Out-Null
    if ((Get-FileHash -LiteralPath $env:TOUCHLINE_DEBUG_KEYSTORE_PATH).Hash -eq $firstHash) { throw 'Fallback signing must be random, not public/deterministic' }
    $passed++
    $env:TOUCHLINE_BUILD_ID = '2001-4'
    $env:UNITY_ANDROID_DEBUG_KEYSTORE_BASE64 = 'invalid-base64!'
    $rejected = $false
    try { & (Join-Path $root 'unity/ci/New-DebugSigning.ps1') | Out-Null } catch { $rejected = $true }
    if (-not $rejected) { throw 'Malformed secret was silently accepted' }
    $passed++
} finally {
    $env:UNITY_ANDROID_DEBUG_KEYSTORE_BASE64 = ''
    Remove-Item -LiteralPath $work -Recurse -Force
}
@{ passed = $passed; failed = 0; powershell = $PSVersionTable.PSVersion.ToString();
   unityExecuted = $false; productionKeystoreOpened = $false; randomDisposableTestKeysVerified = $true } | ConvertTo-Json

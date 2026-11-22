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
try { & (Join-Path $root 'unity/ci/Build-Windows.ps1'); throw 'Missing key accepted' }
catch { if ($_.Exception.Message -notlike '*Opret UNITY_ANDROID_DEBUG_KEYSTORE_BASE64*') { throw } }
$passed++
$env:TOUCHLINE_BUILD_ID = '../escape'
try { & (Join-Path $root 'unity/ci/Publish-AndroidArtifact.ps1'); throw 'Invalid id accepted' }
catch { if ($_.Exception.Message -ne 'Ugyldigt build-id.') { throw } }
$passed++
@{ passed = $passed; failed = 0; powershell = $PSVersionTable.PSVersion.ToString();
   unityExecuted = $false; keystoreOpened = $false } | ConvertTo-Json

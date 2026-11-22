$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ($env:GITHUB_REF -ne 'refs/heads/codex/unity-66-foundation' -or
    $env:GITHUB_REPOSITORY -ne 'omarpedersen1997-png/Touchline37-Game') {
    throw 'Kun den aftalte Unity-branch maa bygges.'
}
$editor = $env:UNITY_EDITOR_PATH
if ([string]::IsNullOrWhiteSpace($editor)) {
    $editor = 'C:\Program Files\Unity\Hub\Editor\6000.6.10f1\Editor\Unity.exe'
}
if (-not (Test-Path -LiteralPath $editor -PathType Leaf)) {
    throw 'Unity 6000.6.10f1 mangler. Installer Android Build Support, SDK/NDK og OpenJDK.'
}
$project = Join-Path $env:GITHUB_WORKSPACE 'unity/TouchlineUnity'
$key = Join-Path $env:RUNNER_TEMP ('touchline-unity-' + $env:TOUCHLINE_BUILD_ID + '.keystore')
$log = Join-Path $env:RUNNER_TEMP ('touchline-unity-' + $env:TOUCHLINE_BUILD_ID + '.log')
if (Test-Path -LiteralPath $key) { throw 'Midlertidig CI-noegle findes allerede; overskriver ikke.' }

try {
    & (Join-Path $PSScriptRoot 'New-DebugSigning.ps1')
    $arguments = @(
        '-batchmode', '-nographics', '-quit', '-buildTarget', 'Android',
        '-projectPath', ('"' + $project + '"'),
        '-executeMethod', 'Touchline.Editor.TouchlineCiBuild.BuildAndroid',
        '-touchlineBranch', $env:GITHUB_REF,
        '-touchlineBuildId', $env:TOUCHLINE_BUILD_ID,
        '-touchlineBuildNumber', $env:TOUCHLINE_BUILD_NUMBER,
        '-touchlineCommit', $env:TOUCHLINE_COMMIT,
        '-touchlineSigningKind', $env:TOUCHLINE_SIGNING_KIND,
        '-touchlineKeystore', ('"' + $key + '"'),
        '-logFile', ('"' + $log + '"')
    )
    $process = Start-Process -FilePath $editor -ArgumentList $arguments -Wait -PassThru
    if ($process.ExitCode -ne 0) {
        # The Unity log can contain licensing details. Do not upload or dump it.
        throw ('Unity afsluttede med kode ' + $process.ExitCode + '. Se den lokale log paa runner-PCen: ' + $log)
    }
}
finally {
    if (Test-Path -LiteralPath $key) { Remove-Item -LiteralPath $key -Force }
}

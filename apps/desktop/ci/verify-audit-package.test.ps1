$ErrorActionPreference = 'Stop'
$verifier = Join-Path $PSScriptRoot 'verify-audit-package.ps1'
$case = ''
$ghCalls = 0
$gitCalls = 0
function gh {
    $script:ghCalls++
    $global:LASTEXITCODE = 0
    @{
        repository = @{ full_name = $(if ($case -eq 'other-repo') { 'other/repo' } else { 'fixture/repo' }) }
        path = $(if ($case -eq 'other-workflow') { '.github/workflows/other.yml' } else { '.github/workflows/desktop.yml' })
        status = 'completed'
        conclusion = $(if ($case -eq 'failed-build') { 'failure' } else { 'success' })
        head_sha = ('a' * 40)
    } | ConvertTo-Json
}
function git {
    $script:gitCalls++
    $global:LASTEXITCODE = 0
    if ($args[0] -eq 'rev-parse') {
        if ($case -eq 'changed-native' -and $args[1] -eq 'HEAD:apps/desktop/src-tauri') {
            return 'c' * 40
        }
        if ($case -eq 'changed-ui' -and $args[1] -eq 'HEAD:apps/desktop/ui') {
            return 'c' * 40
        }
        if ($case -eq 'changed-package' -and $args[1] -eq 'HEAD:apps/desktop/package.json') {
            return 'c' * 40
        }
        if ($case -eq 'changed-icon' -and $args[1] -eq 'HEAD:public/icons/icon-512x512.png') {
            return 'c' * 40
        }
        return 'b' * 40
    }
}
function Reject([string]$Scenario, [string]$RunId, [string]$Expected) {
    $script:case = $Scenario
    $script:ghCalls = 0
    $script:gitCalls = 0
    $message = $null
    try { & $verifier -PackageRun $RunId } catch { $message = $_.Exception.Message }
    if (-not $message -or $message -notlike $Expected) { throw "Wrong rejection for ${Scenario}: $message" }
    Write-Host "PASS: rejects $Scenario"
}
$saved = @{}
foreach ($name in @('GITHUB_ACTIONS', 'GITHUB_REPOSITORY', 'GITHUB_SHA')) {
    $saved[$name] = [Environment]::GetEnvironmentVariable($name)
}
$testDir = Join-Path ([IO.Path]::GetTempPath()) ('tm-package-provenance-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testDir | Out-Null
Push-Location $testDir
try {
    # Only metadata and git-object comparisons are exercised. The gh/git
    # functions above never access GitHub, the network or an actual checkout.
    $env:GITHUB_ACTIONS = 'true'
    $env:GITHUB_REPOSITORY = 'fixture/repo'
    $env:GITHUB_SHA = 'd' * 40
    Reject 'invalid-id' '123;not-a-run' '*numeric workflow run ID*'
    if ($ghCalls -ne 0 -or $gitCalls -ne 0) { throw 'Invalid run ID reached an external command' }
    foreach ($scenario in @('failed-build', 'other-repo', 'other-workflow')) {
        Reject $scenario '123' '*successful desktop build*'
        if ($gitCalls -ne 0) { throw 'Untrusted package reached source retrieval' }
    }
    foreach ($scenario in @('changed-native', 'changed-ui', 'changed-package', 'changed-icon')) {
        Reject $scenario '123' '*differs from current source*'
    }
    $script:case = 'identical'
    & $verifier -PackageRun '123'
    $proof = Get-Content 'recovery-out/package-provenance.json' -Raw | ConvertFrom-Json
    if ($proof.releaseEligible -ne $false -or $proof.sourceObjects.Count -ne 4 -or
        $proof.packageSha -ne ('a' * 40) -or $proof.auditSha -ne ('d' * 40)) {
        throw 'Successful audit provenance is incomplete or marked release-eligible'
    }
    Write-Host 'PASS: accepts identical native/UI/package source only as a non-release audit'
} finally {
    Pop-Location
    foreach ($name in $saved.Keys) { [Environment]::SetEnvironmentVariable($name, $saved[$name]) }
    $proofFile = Join-Path $testDir 'recovery-out/package-provenance.json'
    if (Test-Path -LiteralPath $proofFile) { Remove-Item -LiteralPath $proofFile }
    $proofDir = Join-Path $testDir 'recovery-out'
    if (Test-Path -LiteralPath $proofDir) { [IO.Directory]::Delete($proofDir) }
    [IO.Directory]::Delete($testDir)
}

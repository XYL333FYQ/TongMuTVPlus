param([Parameter(Mandatory)][string]$PackageRun)
$ErrorActionPreference = 'Stop'
if ($env:GITHUB_ACTIONS -ne 'true') { throw 'Only run inside the disposable CI environment.' }
if ($PackageRun -notmatch '^[0-9]+$') { throw 'Package run must be a numeric workflow run ID.' }
$metadata = & gh api "repos/$env:GITHUB_REPOSITORY/actions/runs/$PackageRun"
if ($LASTEXITCODE -ne 0) { throw 'Cannot verify package workflow metadata.' }
$run = $metadata | ConvertFrom-Json
if ($run.repository.full_name -ne $env:GITHUB_REPOSITORY -or
    $run.path -ne '.github/workflows/desktop.yml' -or
    $run.status -ne 'completed' -or $run.conclusion -ne 'success' -or
    $run.head_sha -notmatch '^[0-9a-f]{40}$') {
    throw 'Package must come from a successful desktop build in this repository.'
}
$packageSha = $run.head_sha
& git fetch --no-tags --depth=1 origin $packageSha
if ($LASTEXITCODE -ne 0) { throw 'Cannot retrieve package source identity.' }
$verified = @()
foreach ($source in @('apps/desktop/src-tauri', 'apps/desktop/ui', 'apps/desktop/package.json', 'public/icons/icon-512x512.png')) {
    $packageTree = & git rev-parse ($packageSha + ':' + $source)
    if ($LASTEXITCODE -ne 0) { throw "Package source missing: $source" }
    $currentTree = & git rev-parse ('HEAD:' + $source)
    if ($LASTEXITCODE -ne 0 -or $packageTree -ne $currentTree) {
        throw "Native package differs from current source: $source. Run a full build instead."
    }
    $verified += [pscustomobject]@{ path = $source; object = $currentTree }
}
$out = New-Item -ItemType Directory -Force 'recovery-out'
[pscustomobject]@{
    packageRun = $PackageRun
    packageSha = $packageSha
    auditSha = $env:GITHUB_SHA
    sourceObjects = $verified
    releaseEligible = $false
} | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $out.FullName 'package-provenance.json')
Write-Host "PASS: identical native source; test-only package from $packageSha"

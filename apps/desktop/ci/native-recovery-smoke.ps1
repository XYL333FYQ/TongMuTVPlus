param([Parameter(Mandatory)][string]$Executable)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes, System.Windows.Forms, System.Drawing
$out = New-Item -ItemType Directory -Force 'recovery-out'
$driver = Join-Path $PSScriptRoot 'recovery-cdp.cjs'
$fixture = $null
$client = $null
function Capture([string]$Name) {
    $bounds = [System.Windows.Forms.SystemInformation]::VirtualScreen
    $bitmap = [System.Drawing.Bitmap]::new($bounds.Width, $bounds.Height)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
        $graphics.CopyFromScreen($bounds.Left, $bounds.Top, 0, 0, $bitmap.Size)
        $bitmap.Save((Join-Path $out.FullName "$Name.png"))
    } finally { $graphics.Dispose(); $bitmap.Dispose() }
}
function Wait-Check([scriptblock]$Check, [string]$Label) {
    $deadline = [DateTime]::UtcNow.AddSeconds(35)
    do {
        if (& $Check) { Write-Host "PASS: $Label"; return }
        Start-Sleep -Milliseconds 500
    } while ([DateTime]::UtcNow -lt $deadline)
    Capture 'failure'
    throw "Timed out: $Label"
}
function Native-Button([string]$Name) {
    $pidCondition = [System.Windows.Automation.PropertyCondition]::new(
        [System.Windows.Automation.AutomationElement]::ProcessIdProperty, [int]$client.Id)
    $nameCondition = [System.Windows.Automation.PropertyCondition]::new(
        [System.Windows.Automation.AutomationElement]::NameProperty, $Name)
    $condition = [System.Windows.Automation.AndCondition]::new($pidCondition, $nameCondition)
    return [System.Windows.Automation.AutomationElement]::RootElement.FindFirst(
        [System.Windows.Automation.TreeScope]::Descendants, $condition)
}
function Click-Native([string]$Name) {
    Wait-Check { $null -ne (Native-Button $Name) } "native button $Name"
    $button = Native-Button $Name
    $pattern = $button.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
    $pattern.Invoke()
}
function Cdp([string]$Action, [string]$Url = '') {
    & node $driver $Action $Url
    return $LASTEXITCODE -eq 0
}
try {
    $fixture = Start-Process node -ArgumentList @($driver, 'serve') -WindowStyle Hidden -PassThru
    $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = '--remote-debugging-port=9222'
    $client = Start-Process -FilePath (Resolve-Path $Executable) -PassThru
    Wait-Check {
        try { $null = Invoke-RestMethod 'http://127.0.0.1:9222/json/list'; return $true }
        catch { return $false }
    } 'client DevTools reachable'
    if (-not (Cdp 'navigate' 'http://127.0.0.1:8085/unavailable')) { throw 'Navigate failed' }
    Wait-Check { $null -ne (Native-Button '重新打开') } 'HTTP 503 native recovery'
    Capture '01-http-native'
    Click-Native '重新打开'
    Wait-Check { Cdp 'ready' } 'HTTP retry renders recovered content'
    Capture '02-http-recovered'
    $hostPid = $client.Id
    if (-not (Cdp 'crash')) { throw 'Crash command failed' }
    Wait-Check { $null -ne (Native-Button '重新打开') } 'renderer crash native recovery'
    if (-not (Get-Process -Id $hostPid -ErrorAction SilentlyContinue)) { throw 'Host died with renderer' }
    Capture '03-renderer-native'
    Click-Native '重新打开'
    Wait-Check { Cdp 'ready' } 'renderer retry creates working content'
    if ($client.Id -ne $hostPid -or $client.HasExited) { throw 'Unexpected host restart' }
    Capture '04-renderer-recovered'
    if (-not (Cdp 'navigate' 'http://127.0.0.1:1/')) { throw 'Network navigation failed' }
    Wait-Check { $null -ne (Native-Button '服务器设置') } 'network failure native recovery'
    Capture '05-network-native'
    Click-Native '服务器设置'
    Wait-Check { Cdp 'settings' } 'native recovery opens local settings'
    Capture '06-settings'
    'HTTP retry, actual renderer crash, same host PID, network failure and native settings passed.' |
        Set-Content (Join-Path $out.FullName 'result.txt')
} finally {
    Capture 'final'
    if ($client -and -not $client.HasExited) { Stop-Process -Id $client.Id -Force }
    if ($fixture -and -not $fixture.HasExited) { Stop-Process -Id $fixture.Id -Force }
    Remove-Item Env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS -ErrorAction SilentlyContinue
}
